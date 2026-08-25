import type { ChunkImage, ContentBlock } from '../types';

export interface TextChunk {
  text: string;
  source: string;
  headingPath: string[];
  image?: ChunkImage;
}

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 100;

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Groups a document's structural blocks (paragraphs/list items, each already tagged with
 * the heading it falls under — see docParser.ts) into chunks of roughly CHUNK_SIZE
 * characters. Unlike naive character-window slicing, this:
 *  - never spans two different sections in one chunk (a heading change always starts a
 *    new chunk), so a chunk can't blend unrelated topics together
 *  - hard-slices only when a single block is itself larger than CHUNK_SIZE
 *  - carries the heading path forward on every chunk, so callers can prefix it into the
 *    text used for embedding (giving the vector real topical context) without polluting
 *    the chunk's own text, which stays a verbatim excerpt of the source document.
 *  - keeps every image block as its own standalone chunk (never merged with surrounding
 *    prose), so a retrieved chunk maps 1:1 to "does this carry an image or not".
 */
export function chunkBlocks(blocks: ContentBlock[], source: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let buffer = '';
  let bufferPath: string[] = [];

  const flush = () => {
    if (buffer.trim()) chunks.push({ text: buffer.trim(), source, headingPath: bufferPath });
    buffer = '';
  };

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;

    if (block.image) {
      flush();
      chunks.push({ text, source, headingPath: block.headingPath, image: block.image });
      bufferPath = block.headingPath;
      continue;
    }

    if (!samePath(block.headingPath, bufferPath) && buffer) {
      flush();
    }
    bufferPath = block.headingPath;

    if (text.length > CHUNK_SIZE) {
      flush();
      for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        const slice = text.slice(i, i + CHUNK_SIZE);
        if (slice.trim()) chunks.push({ text: slice.trim(), source, headingPath: block.headingPath });
      }
      bufferPath = block.headingPath;
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${text}` : text;
    if (candidate.length > CHUNK_SIZE) {
      flush();
      buffer = text;
      bufferPath = block.headingPath;
    } else {
      buffer = candidate;
    }
  }
  flush();

  return chunks;
}

export function chunkDocuments(docs: { blocks: ContentBlock[]; name: string }[]): TextChunk[] {
  return docs.flatMap((d) => chunkBlocks(d.blocks, d.name));
}

/**
 * Reconstructs a document's full text with its heading structure restored (as Markdown-style
 * headers), for "Full-Text Mode" — where retrieval is skipped entirely and the whole document
 * is sent to the AI verbatim. Images are left out here; callers should attach them separately
 * (see ragPipeline.ts's buildFullTextChunks), matching how retrieval-based chunks work.
 */
export function renderFullText(blocks: ContentBlock[]): string {
  const lines: string[] = [];
  let lastPath: string[] = [];
  for (const block of blocks) {
    if (block.image) continue;
    const text = block.text.trim();
    if (!text) continue;
    if (!samePath(block.headingPath, lastPath) && block.headingPath.length > 0) {
      lines.push(`## ${block.headingPath.join(' > ')}`);
      lastPath = block.headingPath;
    }
    lines.push(text);
  }
  return lines.join('\n\n');
}

/** Text actually embedded: heading context is prepended so the vector captures topical
 *  location, but this string is only ever used to compute the embedding — the chunk's
 *  own `text` (stored and shown to the LLM/user) stays an untouched excerpt of the source.
 *  For image chunks, the caption (or heading context, if no caption was found) stands in
 *  for the image itself — we have no way to "read" the diagram's content at index time
 *  without an AI call, so the text around it is what makes it findable by search. */
export function toEmbeddingText(chunk: TextChunk): string {
  const prefix = chunk.headingPath.length > 0 ? `[章節: ${chunk.headingPath.join(' > ')}]\n` : '';
  if (chunk.image) {
    return `${prefix}[圖片說明: ${chunk.image.caption || chunk.text}]`;
  }
  return `${prefix}${chunk.text}`;
}
