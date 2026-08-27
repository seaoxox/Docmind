import type { ChunkImage, ContentBlock } from '../types';
import { uid } from '../lib/utils';

export interface TextChunk {
  text: string;
  source: string;
  headingPath: string[];
  image?: ChunkImage;
}

// Children are small and precise — good for embedding/matching. Parents are large sections —
// good for giving the AI complete context once a child match tells us which section matters.
const PARENT_CHUNK_SIZE = 2000;
const PARENT_OVERLAP = 200;
const CHILD_CHUNK_SIZE = 350;
const CHILD_OVERLAP = 50;

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Groups a document's structural blocks (paragraphs/list items, each already tagged with
 * the heading it falls under — see docParser.ts) into chunks of roughly `chunkSize`
 * characters. Unlike naive character-window slicing, this:
 *  - never spans two different sections in one chunk (a heading change always starts a
 *    new chunk), so a chunk can't blend unrelated topics together
 *  - hard-slices only when a single block is itself larger than `chunkSize`
 *  - carries the heading path forward on every chunk
 *  - keeps every image block as its own standalone chunk (never merged with surrounding
 *    prose), so a chunk maps 1:1 to "does this carry an image or not"
 */
function groupBlocksIntoChunks(blocks: ContentBlock[], source: string, chunkSize: number, overlap: number): TextChunk[] {
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

    if (text.length > chunkSize) {
      flush();
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const slice = text.slice(i, i + chunkSize);
        if (slice.trim()) chunks.push({ text: slice.trim(), source, headingPath: block.headingPath });
      }
      bufferPath = block.headingPath;
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${text}` : text;
    if (candidate.length > chunkSize) {
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

/** Splits a parent chunk's OWN text into smaller children, on the paragraph breaks that
 *  survived from the original blocks (groupBlocksIntoChunks joins blocks with "\n\n"), so
 *  children are always guaranteed to nest cleanly inside the parent they came from — no
 *  separate boundary-matching logic needed. */
function splitParentIntoChildren(parentText: string, chunkSize: number, overlap: number): string[] {
  const paragraphs = parentText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) chunks.push(buffer.trim());
    buffer = '';
  };

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      flush();
      for (let i = 0; i < para.length; i += chunkSize - overlap) {
        const slice = para.slice(i, i + chunkSize);
        if (slice.trim()) chunks.push(slice.trim());
      }
      continue;
    }
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (candidate.length > chunkSize) {
      flush();
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  flush();

  return chunks.length > 0 ? chunks : [parentText.trim()];
}

export interface ParentChunk {
  id: string;
  text: string;
  source: string;
  headingPath: string[];
  image?: ChunkImage;
}

export interface ChildChunk {
  text: string;
  source: string;
  headingPath: string[];
  parentId: string;
  image?: ChunkImage;
}

export interface HierarchicalChunks {
  parents: ParentChunk[];
  children: ChildChunk[];
}

/**
 * Two-level ("Parent-Child" / small-to-big) chunking: builds large parent sections first
 * (respecting heading boundaries, same as the old flat chunker), then further splits each
 * parent's own text into small children for embedding. At query time, the small children
 * are what gets matched against the question — good for precision — but the chunk actually
 * handed to the AI is the child's PARENT, so the model still sees full section context
 * instead of an isolated, possibly under-contextualized fragment.
 */
export function chunkBlocksHierarchical(blocks: ContentBlock[], source: string): HierarchicalChunks {
  const parentChunks = groupBlocksIntoChunks(blocks, source, PARENT_CHUNK_SIZE, PARENT_OVERLAP);
  const parents: ParentChunk[] = [];
  const children: ChildChunk[] = [];

  for (const p of parentChunks) {
    const parentId = uid('parent');
    parents.push({ id: parentId, text: p.text, source: p.source, headingPath: p.headingPath, image: p.image });

    if (p.image) {
      // An image parent is already small (just a caption) — one child, no further splitting.
      children.push({ text: p.text, source: p.source, headingPath: p.headingPath, parentId, image: p.image });
      continue;
    }

    const childTexts = splitParentIntoChildren(p.text, CHILD_CHUNK_SIZE, CHILD_OVERLAP);
    for (const childText of childTexts) {
      children.push({ text: childText, source: p.source, headingPath: p.headingPath, parentId });
    }
  }

  return { parents, children };
}

export function chunkDocumentsHierarchical(docs: { blocks: ContentBlock[]; name: string }[]): HierarchicalChunks {
  const allParents: ParentChunk[] = [];
  const allChildren: ChildChunk[] = [];
  for (const d of docs) {
    const { parents, children } = chunkBlocksHierarchical(d.blocks, d.name);
    allParents.push(...parents);
    allChildren.push(...children);
  }
  return { parents: allParents, children: allChildren };
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
export function toEmbeddingText(chunk: { text: string; headingPath: string[]; image?: ChunkImage }): string {
  const prefix = chunk.headingPath.length > 0 ? `[章節: ${chunk.headingPath.join(' > ')}]\n` : '';
  if (chunk.image) {
    return `${prefix}[圖片說明: ${chunk.image.caption || chunk.text}]`;
  }
  return `${prefix}${chunk.text}`;
}
