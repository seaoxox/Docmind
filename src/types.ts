export type DocType = 'markdown' | 'word' | 'pdf' | 'text' | 'unknown';
export type DocCategory = 'guidance' | 'manual';

export interface ChunkImage {
  dataUrl: string;
  caption: string;
}

/** A single structural unit of a document (one paragraph, list item, or image), tagged with
 *  the heading/section it falls under, so chunking can respect real document structure
 *  and each chunk can carry its own topical context. */
export interface ContentBlock {
  headingPath: string[];
  text: string;
  image?: ChunkImage;
}

export interface AppDocument {
  id: string;
  name: string;
  content: string;
  blocks: ContentBlock[];
  type: DocType;
  category: DocCategory;
  sizeChars: number;
}

export interface Citation {
  text: string;
  source: string;
}

export interface RetrievedChunk {
  text: string;
  source: string;
  score: number;
  headingPath?: string[];
  image?: ChunkImage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  model: string;
}

export interface QuestionRecord {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
  timestamp: number;
  retrievedSources: string[];
  usedImageCount: number;
  usedFullTextMode: boolean;
  rewrittenQuery: string | null;
  usage: TokenUsage | null;
}

export type AiProvider = 'gemini' | 'openai' | 'anthropic';

export interface ModelOption {
  id: string;
  label: string;
  tier: '快速' | '基礎';
}

export interface ProviderSettings {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export interface StoredProviderSettings {
  activeProvider: AiProvider;
  apiKeys: Record<AiProvider, string>;
  models: Record<AiProvider, string>;
}

export interface RagSettings {
  topK: number;
  queryRewrite: boolean;
}

export interface ManualFileEntry {
  filename: string;
  path: string; // relative path under manual_md/, used for fetch
  type: 'markdown' | 'image' | 'other';
  bytes: number; // captured at build time from disk, stable across CDN/browser cache staleness
}

export interface ManualChapter {
  folder: string;
  title: string;
  files: ManualFileEntry[];
}

export interface ManifestFile {
  name: string;
  bytes: number; // captured at build time from disk
}

export interface Manifest {
  guidanceFiles: ManifestFile[];
  manual: ManualChapter[];
}

export type ViewMode = 'qa' | 'manual';

