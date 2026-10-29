import type { AiProvider, ModelOption } from '../types';
import { MODEL_OPTIONS } from './models';

const CACHE_KEY = 'docmind.models';

export interface DiscoveredModels {
  models: ModelOption[];
  fetchedAt: number;
}

type DiscoveryCache = Partial<Record<AiProvider, DiscoveredModels>>;

/** Heuristic: the list APIs don't expose a "tier", so guess from the model id. */
const FAST_PATTERN = /flash-lite|lite|mini|nano|haiku|luna/i;
const BASE_PATTERN = /flash|pro|sonnet|opus|terra|gpt|^o\d|claude|gemini/i;

function guessTier(id: string): ModelOption['tier'] {
  if (FAST_PATTERN.test(id)) return '快速';
  if (BASE_PATTERN.test(id)) return '基礎';
  return undefined;
}

// OpenAI's /models mixes every model type together with no capability info.
const OPENAI_EXCLUDE = /embedding|whisper|tts|dall-e|image|moderation|audio|realtime|transcribe|search|davinci|babbage|instruct/i;
const OPENAI_INCLUDE = /^(gpt|o\d|chatgpt)/i;

async function readError(res: Response, label: string): Promise<Error> {
  if (res.status === 401 || res.status === 403) return new Error(`${label} API Key 無效或沒有權限 (${res.status})。`);
  const text = await res.text().catch(() => '');
  return new Error(`${label} 取得模型清單失敗 (${res.status}): ${text || res.statusText}`);
}

async function fetchGemini(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const models: ModelOption[] = [];
  let pageToken = '';
  do {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { 'x-goog-api-key': apiKey }, signal });
    if (!res.ok) throw await readError(res, 'Gemini');
    const data = await res.json();
    for (const m of data?.models ?? []) {
      const methods: string[] = m.supportedGenerationMethods ?? [];
      if (!methods.includes('generateContent')) continue;
      const id = String(m.name ?? '').replace(/^models\//, '');
      if (!id.startsWith('gemini')) continue;
      models.push({ id, label: String(m.displayName || id), tier: guessTier(id) });
    }
    pageToken = data?.nextPageToken ?? '';
  } while (pageToken);
  return models;
}

async function fetchOpenAI(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal });
  if (!res.ok) throw await readError(res, 'OpenAI');
  const data = await res.json();
  const models: ModelOption[] = [];
  for (const m of data?.data ?? []) {
    const id = String(m.id ?? '');
    if (!OPENAI_INCLUDE.test(id) || OPENAI_EXCLUDE.test(id)) continue;
    models.push({ id, label: id, tier: guessTier(id) });
  }
  return models;
}

async function fetchAnthropic(apiKey: string, signal?: AbortSignal): Promise<ModelOption[]> {
  const models: ModelOption[] = [];
  let afterId = '';
  for (;;) {
    const url = `https://api.anthropic.com/v1/models?limit=1000${afterId ? `&after_id=${encodeURIComponent(afterId)}` : ''}`;
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal,
    });
    if (!res.ok) throw await readError(res, 'Anthropic');
    const data = await res.json();
    for (const m of data?.data ?? []) {
      const id = String(m.id ?? '');
      models.push({ id, label: String(m.display_name || id), tier: guessTier(id) });
    }
    if (!data?.has_more || !data?.last_id) break;
    afterId = data.last_id;
  }
  return models;
}

function loadCache(): DiscoveryCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The result of the last successful detection for this provider, or null if never fetched. */
export function loadDiscoveredModels(provider: AiProvider): DiscoveredModels | null {
  const entry = loadCache()[provider];
  return entry && Array.isArray(entry.models) && typeof entry.fetchedAt === 'number' ? entry : null;
}

/** Calls the provider's list-models API and persists the result. The cache is only ever
 *  replaced by a later successful fetch — failures leave the previous result untouched. */
export async function discoverModels(provider: AiProvider, apiKey: string, signal?: AbortSignal): Promise<DiscoveredModels> {
  if (!apiKey.trim()) throw new Error('請先輸入此供應商的 API Key。');
  const key = apiKey.trim();

  let models: ModelOption[];
  switch (provider) {
    case 'gemini':
      models = await fetchGemini(key, signal);
      break;
    case 'openai':
      models = await fetchOpenAI(key, signal);
      break;
    case 'anthropic':
      models = await fetchAnthropic(key, signal);
      break;
    default:
      throw new Error('未知的 AI 供應商');
  }
  if (models.length === 0) throw new Error('供應商沒有回傳任何可用的聊天模型。');

  const result: DiscoveredModels = { models, fetchedAt: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...loadCache(), [provider]: result }));
  } catch {
    /* storage full or unavailable — the in-memory result is still returned */
  }
  return result;
}

/** Curated models first (keeping their labels/tiers), then any other detected models. */
export function mergeModelOptions(provider: AiProvider, discovered: DiscoveredModels | null): ModelOption[] {
  const curated = MODEL_OPTIONS[provider];
  if (!discovered) return curated;
  const known = new Set(curated.map((m) => m.id));
  return [...curated, ...discovered.models.filter((m) => !known.has(m.id))];
}
