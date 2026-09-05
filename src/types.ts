export type DocType = 'markdown' | 'word' | 'pdf' | 'text' | 'unknown';
export type DocCategory = 'guidance';

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
  /** The small child snippet that actually scored this match — `text` here is its larger
   *  PARENT (see Parent-Child retrieval), so this is what to show if you want to explain
   *  *why* this particular section got pulled in. */
  matchedText?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  model: string;
}

export interface UsedChunk {
  text: string;
  source: string;
  score: number;
  headingPath: string[];
  hasImage: boolean;
  matchedText?: string;
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
  usedChunks: UsedChunk[];
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

export interface ManifestFile {
  name: string;
  bytes: number; // captured at build time from disk
}

export interface Manifest {
  guidanceFiles: ManifestFile[];
}

/** One entry in guidance_categories.json — a named grouping of guidance_docs files
 *  (e.g. "結核病指引"), hand-maintained by whoever curates the document set. */
export interface GuidanceCategory {
  id: string;
  name: string;
  description?: string;
  files: string[];
}

export interface GuidanceCategoriesConfig {
  categories: GuidanceCategory[];
}

export type ViewMode = 'qa' | 'manual';

