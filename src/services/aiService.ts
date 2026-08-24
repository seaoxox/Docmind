import type { ChunkImage, Citation, ProviderSettings, RetrievedChunk } from '../types';
import { computeCost } from './models';

export interface RawTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  usage: RawTokenUsage;
  imageCount: number;
  raw?: string;
}

/** A retrieved chunk is sent to the AI as an image (not just its caption text) only when
 *  it's judged relevant enough to include as context — capped to keep payload/cost sane. */
const MAX_IMAGES_PER_QUESTION = 4;

const SYSTEM_PROMPT = `You are a document assistant. Your task is to answer questions based STRICTLY on the provided context passages.
If the answer is not contained in the context, clearly say you don't know based on the provided documents. Do not fabricate information.
Some context passages are diagrams/flowcharts provided as images alongside their caption — read them visually when relevant to the question.

Formatting Rules:
1. Provide a concise, accurate answer in Traditional Chinese (繁體中文), using Markdown for structure (headings/bullets) where helpful.
2. For every claim or paragraph in the answer, you MUST provide supporting citations drawn verbatim from the context. For a claim based on an image, cite its caption text instead.
3. Respond with ONLY a raw JSON object (no markdown code fences, no commentary) with this exact structure:
{
  "answer": "The full text answer here, in Markdown.",
  "citations": [
    { "text": "The EXACT ORIGINAL QUOTATION (or image caption) from the context that supports this part of the answer", "source": "The name of the source document" }
  ]
}`;

export function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c) => {
      const headingLine = c.headingPath && c.headingPath.length > 0 ? `\n[Section: ${c.headingPath.join(' > ')}]` : '';
      const imageNote = c.image ? '\n[This passage is a diagram/image attached separately below, with this caption:]' : '';
      return `[Document: ${c.source}]${headingLine}${imageNote}\n${c.text}`;
    })
    .join('\n\n---\n\n');
}

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]): string {
  return `Context (retrieved passages, most relevant first):\n${buildContext(chunks)}\n\n---\n\nQuestion: ${question}`;
}

export const SYSTEM_PROMPT_TEXT = SYSTEM_PROMPT;

function collectImages(chunks: RetrievedChunk[]): ChunkImage[] {
  const images: ChunkImage[] = [];
  for (const c of chunks) {
    if (c.image && images.length < MAX_IMAGES_PER_QUESTION) images.push(c.image);
  }
  return images;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/** Safely parse a JSON answer, tolerating stray markdown fences or prose around it. */
function safeParseAnswer(text: string, usage: RawTokenUsage, imageCount: number): AskResult {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate = firstBrace !== -1 && lastBrace !== -1 ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.answer === 'string') {
      const citations: Citation[] = Array.isArray(parsed.citations)
        ? parsed.citations
            .filter((c: unknown) => c && typeof c === 'object')
            .map((c: { text?: string; source?: string }) => ({
              text: String(c.text ?? ''),
              source: String(c.source ?? ''),
            }))
        : [];
      return { answer: parsed.answer, citations, usage, imageCount, raw: text };
    }
  } catch {
    // fall through to plain-text fallback
  }
  return { answer: text, citations: [], usage, imageCount, raw: text };
}

async function callGemini(settings: ProviderSettings, question: string, chunks: RetrievedChunk[]): Promise<AskResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${encodeURIComponent(
    settings.apiKey
  )}`;

  const images = collectImages(chunks);
  const imageParts = images
    .map((img) => parseDataUrl(img.dataUrl))
    .filter((p): p is { mimeType: string; base64: string } => p !== null)
    .map((p) => ({ inline_data: { mime_type: p.mimeType, data: p.base64 } }));

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(question, chunks) }, ...imageParts] }],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini 未回傳任何內容，請確認模型名稱與 API Key 是否正確。');

  const usage: RawTokenUsage = {
    inputTokens: Number(data?.usageMetadata?.promptTokenCount ?? 0),
    outputTokens: Number(data?.usageMetadata?.candidatesTokenCount ?? 0),
  };
  return safeParseAnswer(text, usage, imageParts.length);
}

async function callOpenAI(settings: ProviderSettings, question: string, chunks: RetrievedChunk[]): Promise<AskResult> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const images = collectImages(chunks);
  const imageParts = images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } }));

  const userContent =
    imageParts.length > 0 ? [{ type: 'text', text: buildUserPrompt(question, chunks) }, ...imageParts] : buildUserPrompt(question, chunks);

  const body = {
    model: settings.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('OpenAI 未回傳任何內容，請確認模型名稱與 API Key 是否正確。');

  const usage: RawTokenUsage = {
    inputTokens: Number(data?.usage?.prompt_tokens ?? 0),
    outputTokens: Number(data?.usage?.completion_tokens ?? 0),
  };
  return safeParseAnswer(text, usage, imageParts.length);
}

async function callAnthropic(settings: ProviderSettings, question: string, chunks: RetrievedChunk[]): Promise<AskResult> {
  const url = 'https://api.anthropic.com/v1/messages';

  const images = collectImages(chunks);
  const imageParts = images
    .map((img) => parseDataUrl(img.dataUrl))
    .filter((p): p is { mimeType: string; base64: string } => p !== null)
    .map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.base64 } }));

  const userContent =
    imageParts.length > 0 ? [{ type: 'text', text: buildUserPrompt(question, chunks) }, ...imageParts] : buildUserPrompt(question, chunks);

  const body = {
    model: settings.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API 錯誤 (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();
  const text: string =
    data?.content?.map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text ?? '' : '')).join('') ?? '';
  if (!text) throw new Error('Anthropic 未回傳任何內容，請確認模型名稱與 API Key 是否正確。');

  const usage: RawTokenUsage = {
    inputTokens: Number(data?.usage?.input_tokens ?? 0),
    outputTokens: Number(data?.usage?.output_tokens ?? 0),
  };
  return safeParseAnswer(text, usage, imageParts.length);
}

export async function askQuestion(settings: ProviderSettings, question: string, chunks: RetrievedChunk[]): Promise<AskResult> {
  if (!settings.apiKey.trim()) {
    throw new Error('請先在「設定」中輸入您的 API Key。');
  }
  if (chunks.length === 0) {
    throw new Error('向量索引中找不到相關段落，請確認指引文件是否已建立索引完成。');
  }

  switch (settings.provider) {
    case 'gemini':
      return callGemini(settings, question, chunks);
    case 'openai':
      return callOpenAI(settings, question, chunks);
    case 'anthropic':
      return callAnthropic(settings, question, chunks);
    default:
      throw new Error('未知的 AI 供應商');
  }
}

export function usageToTokenUsage(usage: RawTokenUsage, model: string) {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cost: computeCost(model, usage.inputTokens, usage.outputTokens),
    model,
  };
}
