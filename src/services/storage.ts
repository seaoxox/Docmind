import type { AiProvider, ProviderSettings, QuestionRecord, RagSettings, StoredProviderSettings } from '../types';
import { DEFAULT_MODELS } from './models';
import { TOP_K } from './ragPipeline';

const KEYS = {
  settings: 'docmind.settings',
  rag: 'docmind.rag',
  history: 'docmind.history',
  theme: 'docmind.theme',
  disclaimer: 'disclaimerAcceptedDate',
};

const PROVIDERS: AiProvider[] = ['gemini', 'openai', 'anthropic'];

function emptyKeyMap(): Record<AiProvider, string> {
  return { gemini: '', openai: '', anthropic: '' };
}

function defaultModelMap(): Record<AiProvider, string> {
  return { ...DEFAULT_MODELS };
}

export function loadSettings(): StoredProviderSettings {
  const fallback: StoredProviderSettings = {
    activeProvider: 'gemini',
    apiKeys: emptyKeyMap(),
    models: defaultModelMap(),
  };

  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    // New format: already has per-provider maps.
    if (parsed && typeof parsed === 'object' && parsed.apiKeys && parsed.models) {
      const apiKeys = emptyKeyMap();
      const models = defaultModelMap();
      for (const p of PROVIDERS) {
        if (typeof parsed.apiKeys[p] === 'string') apiKeys[p] = parsed.apiKeys[p];
        if (typeof parsed.models[p] === 'string' && parsed.models[p]) models[p] = parsed.models[p];
      }
      const activeProvider: AiProvider = PROVIDERS.includes(parsed.activeProvider) ? parsed.activeProvider : 'gemini';
      return { activeProvider, apiKeys, models };
    }

    // Legacy format from before per-provider storage: { provider, apiKey, model }.
    if (parsed && typeof parsed === 'object' && typeof parsed.apiKey === 'string' && typeof parsed.provider === 'string') {
      const apiKeys = emptyKeyMap();
      const models = defaultModelMap();
      const provider: AiProvider = PROVIDERS.includes(parsed.provider) ? parsed.provider : 'gemini';
      apiKeys[provider] = parsed.apiKey;
      if (typeof parsed.model === 'string' && parsed.model) models[provider] = parsed.model;
      return { activeProvider: provider, apiKeys, models };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveSettings(settings: StoredProviderSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

/** Resolves the currently-active provider's key/model into the flat shape aiService expects. */
export function resolveActiveSettings(stored: StoredProviderSettings): ProviderSettings {
  return {
    provider: stored.activeProvider,
    apiKey: stored.apiKeys[stored.activeProvider] ?? '',
    model: stored.models[stored.activeProvider] || DEFAULT_MODELS[stored.activeProvider],
  };
}

export const RAG_TOP_K_BOUNDS = { min: 4, max: 64 } as const;
const MIN_TOP_K = RAG_TOP_K_BOUNDS.min;
const MAX_TOP_K = RAG_TOP_K_BOUNDS.max;

export function loadRagSettings(): RagSettings {
  const fallback: RagSettings = { topK: TOP_K, queryRewrite: false };
  try {
    const raw = localStorage.getItem(KEYS.rag);
    if (raw) {
      const parsed = JSON.parse(raw);
      const topK = Number(parsed?.topK);
      return {
        topK: Number.isFinite(topK) ? Math.min(MAX_TOP_K, Math.max(MIN_TOP_K, Math.round(topK))) : fallback.topK,
        queryRewrite: typeof parsed?.queryRewrite === 'boolean' ? parsed.queryRewrite : fallback.queryRewrite,
      };
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveRagSettings(settings: RagSettings) {
  localStorage.setItem(KEYS.rag, JSON.stringify(settings));
}

export function loadHistory(): QuestionRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.history);
    if (raw) {
    /* ignore */
  }
  return [];
}

export function saveHistory(history: QuestionRecord[]) {
  try {
    localStorage.setItem(KEYS.history, JSON.stringify(history));
  } catch {
    // localStorage quota exceeded; drop oldest half and retry once
    const trimmed = history.slice(0, Math.floor(history.length / 2));
    try {
      localStorage.setItem(KEYS.history, JSON.stringify(trimmed));
    } catch {
      /* give up silently */
    }
  }
}

export function loadTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(KEYS.theme);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: 'light' | 'dark') {
  localStorage.setItem(KEYS.theme, theme);
}

export function getDisclaimerAcceptedDate(): string | null {
  return localStorage.getItem(KEYS.disclaimer);
}

export function setDisclaimerAcceptedDate(dateStr: string) {
  localStorage.setItem(KEYS.disclaimer, dateStr);
}
