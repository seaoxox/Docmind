import type { ProviderSettings } from '../types';
import { postWithRateLimitRetry } from './aiService';

const REWRITE_SYSTEM_PROMPT = `You rewrite a user's casual question into a search query phrased closer to how the answer would actually be worded in formal Traditional Chinese medical/administrative guideline documents. Expand abbreviations and add the formal/clinical/administrative terminology the source document would likely use. Every part of the original question's meaning (who, what condition, what action) must still be represented in the rewrite — do not answer the question, do not add information not implied by it.

The rewritten query MUST be a complete phrase or sentence, never a single bare word or topic keyword. Collapsing the question down to one or two generic terms is a failure, even if that term is technically related.

Examples:
Original: 誰可以申請防癆補助
Rewritten: 結核病患者申請防癆補助之資格條件與適用對象

Original: 疑似TB不能用哪些藥物治療
Rewritten: 疑似結核病病人於鑑別診斷期間應排除使用之藥物與抗生素治療禁忌

Original: 密切接觸者要做什麼檢查
Rewritten: 結核病密切接觸者接觸者檢查與追蹤流程之檢驗項目

Respond with ONLY the rewritten query text in Traditional Chinese. No quotes, no explanation, no markdown, no preamble.`;

export interface RewriteResult {
  rewritten: string;
  usage: { inputTokens: number; outputTokens: number };
}

const EMPTY_USAGE = { inputTokens: 0, outputTokens: 0 };

async function rewriteWithGemini(settings: ProviderSettings, question: string): Promise<RewriteResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${encodeURIComponent(
    settings.apiKey
  )}`;
  const body = {
    systemInstruction: { parts: [{ text: REWRITE_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { maxOutputTokens: 100 },
  };

  const res = await postWithRateLimitRetry(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    'Gemini'
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim() ?? '';
  const usage = {
    inputTokens: Number(data?.usageMetadata?.promptTokenCount ?? 0),
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount ?? 0),
  };
  return { rewritten: text || question, usage };
}

async function rewriteWithOpenAI(settings: ProviderSettings, question: string): Promise<RewriteResult> {
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: settings.model,
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: question },
    ],
    max_tokens: 100,
  };

  const res = await postWithRateLimitRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(body),
    },
    'OpenAI'
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string = (data?.choices?.[0]?.message?.content ?? '').trim();
  const usage = {
    inputTokens: Number(data?.usage?.prompt_tokens ?? 0),
    outputTokens: Number(data?.usage?.completion_tokens ?? 0),
  };
  return { rewritten: text || question, usage };
}

async function rewriteWithAnthropic(settings: ProviderSettings, question: string): Promise<RewriteResult> {
  const url = 'https://api.anthropic.com/v1/messages';
  const body = {
    model: settings.model,
    max_tokens: 100,
    system: REWRITE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  };

  const res = await postWithRateLimitRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    },
    'Anthropic'
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string = (
    data?.content?.map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text ?? '' : '')).join('') ?? ''
  ).trim();
  const usage = {
    inputTokens: Number(data?.usage?.input_tokens ?? 0),
    outputTokens: Number(data?.usage?.output_tokens ?? 0),
  };
  return { rewritten: text || question, usage };
}

/**
 * Rewrites a casual question into wording closer to formal document terminology, purely to
 * improve vector search recall — the ORIGINAL question is still what gets answered; only the
 * search query changes. Failures here are meant to be non-fatal for callers: on error, they
 * should fall back to searching with the original question alone.
 */
export async function rewriteQuery(settings: ProviderSettings, question: string): Promise<RewriteResult> {
  if (!settings.apiKey.trim()) return { rewritten: question, usage: EMPTY_USAGE };

  switch (settings.provider) {
    case 'gemini':
      return rewriteWithGemini(settings, question);
    case 'openai':
      return rewriteWithOpenAI(settings, question);
    case 'anthropic':
      return rewriteWithAnthropic(settings, question);
    default:
      return { rewritten: question, usage: EMPTY_USAGE };
  }
}
