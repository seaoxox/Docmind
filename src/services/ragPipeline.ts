import type { AppDocument, Manifest, RetrievedChunk } from '../types';
import { chunkDocuments, renderFullText, toEmbeddingText } from './chunking';
import { embedQuery, embedTexts, type EmbeddingProgress } from './embeddingService';
import { clearChunks, countChunks, getAllChunks, getMeta, putChunks, setMeta, type StoredChunk } from './vectorStore';
import { uid } from '../lib/utils';

const FINGERPRINT_KEY = 'guidance-fingerprint';
export const TOP_K = 16;

export type IndexStatus =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'embedding'; done: number; total: number; currentSource?: string }
  | { phase: 'ready'; chunkCount: number }
  | { phase: 'error'; message: string };

/**
 * Deterministic fingerprint of the current guidance corpus, computed ONLY from manifest.json
 * (filenames + build-time byte sizes) — never from a runtime fetch of the actual document
 * bodies. manifest.json is always fetched with `cache: 'no-store'`, so it's the one source we
 * can trust to reflect the latest deployment; the documents themselves may still be served
 * stale for a few minutes by a CDN edge node or the browser's HTTP cache after a fresh deploy.
 * Basing the fingerprint on those would cause spurious "content changed" rebuilds until every
 * cache layer catches up — which is exactly what a manifest-based fingerprint avoids.
 */
async function computeFingerprint(manifest: Manifest): Promise<string> {
  const guidancePart = manifest.guidanceFiles.map((f) => `${f.name}:${f.bytes}`).sort();
  const manualPart = manifest.manual.flatMap((chapter) =>
    chapter.files.map((f) => `${chapter.folder}/${f.filename}:${f.bytes}`)
  ).sort();
  const summary = [...guidancePart, ...manualPart].join('|');
  const encoded = new TextEncoder().encode(summary);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

let cachedChunks: StoredChunk[] | null = null;

/**
 * Ensures the local vector index reflects the current set of guidance/manual documents.
 * On first run (or whenever manifest.json indicates the underlying documents have changed),
 * this chunks every document, embeds each chunk locally via a Hugging Face model, and persists
 * the vectors to IndexedDB. On subsequent runs with an unchanged manifest, this is a fast no-op.
 */
export async function ensureIndex(
  docs: AppDocument[],
  manifest: Manifest,
  onStatus: (status: IndexStatus) => void,
  forceRebuild = false
): Promise<void> {
  onStatus({ phase: 'checking' });

  let fingerprint: string | null = null;
  try {
    fingerprint = await computeFingerprint(manifest);
  } catch (err) {
    // If we can't compute a fingerprint for some reason (e.g. an unusual hosting
    // environment without Web Crypto), don't treat that as "documents changed" —
    // fall back to whatever index already exists rather than needlessly rebuilding.
    console.warn('無法計算文件指紋，將略過變更偵測：', err);
  }

  const storedFingerprint = await getMeta(FINGERPRINT_KEY);
  const existingCount = await countChunks();

  if (!forceRebuild && existingCount > 0 && (fingerprint === null || storedFingerprint === fingerprint)) {
    cachedChunks = null; // will lazy-load from IndexedDB on first search
    onStatus({ phase: 'ready', chunkCount: existingCount });
    return;
  }

  try {
    await clearChunks();
    const chunks = chunkDocuments(docs.map((d) => ({ blocks: d.blocks, name: d.name })));

    if (chunks.length === 0) {
      if (fingerprint !== null) await setMeta(FINGERPRINT_KEY, fingerprint);
      onStatus({ phase: 'ready', chunkCount: 0 });
      return;
    }

    const BATCH_SIZE = 16;
    const stored: StoredChunk[] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      // Most representative source in this batch, for a friendlier progress message.
      const batchSourceCounts = new Map<string, number>();
      for (const c of batch) batchSourceCounts.set(c.source, (batchSourceCounts.get(c.source) ?? 0) + 1);
      const currentSource = Array.from(batchSourceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

      const vectors = await embedTexts(
        batch.map((c) => toEmbeddingText(c)),
        (p: EmbeddingProgress) => {
          // Model download progress (first run only) reported as 0-100 per file;
          // we surface it as part of the same "embedding" phase for simplicity.
          if (p.progress !== undefined) {
            onStatus({ phase: 'embedding', done: i, total: chunks.length, currentSource });
          }
        }
      );
      const newlyStored = batch.map((c, idx) => ({
        id: uid('chunk'),
        text: c.text,
        source: c.source,
        embedding: vectors[idx],
        headingPath: c.headingPath,
        image: c.image,
      }));
      stored.push(...newlyStored);
      await putChunks(newlyStored);
      onStatus({ phase: 'embedding', done: Math.min(i + BATCH_SIZE, chunks.length), total: chunks.length, currentSource });
    }

    if (fingerprint !== null) await setMeta(FINGERPRINT_KEY, fingerprint);
    cachedChunks = null;
    onStatus({ phase: 'ready', chunkCount: chunks.length });
  } catch (err) {
    onStatus({ phase: 'error', message: err instanceof Error ? err.message : '建立向量索引時發生錯誤。' });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Embeddings are already normalized (unit length), so dot product == cosine similarity.
  return dot;
}

/**
 * Performs a semantic search over the local vector index and returns the top-K most relevant
 * chunks, with a per-source cap so a single large document can't monopolize every slot even
 * when it happens to score well on broad questions. Relevance is still the primary ranking
 * signal — the cap only kicks in once a source has already claimed a generous share of the
 * results, leaving room for other documents to surface when they're genuinely relevant too.
 */
export async function search(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]> {
  if (!cachedChunks) {
    cachedChunks = await getAllChunks();
  }
  if (cachedChunks.length === 0) return [];

  const queryVec = await embedQuery(query);
  const scored = cachedChunks
    .map((c) => ({
      text: c.text,
      source: c.source,
      headingPath: c.headingPath,
      image: c.image,
      score: cosineSimilarity(queryVec, c.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  const distinctSources = new Set(scored.map((c) => c.source)).size;
  // With few distinct sources, a stricter cap would just force in irrelevant filler —
  // only diversify meaningfully once there's more than one source to diversify across.
  const maxPerSource = distinctSources <= 1 ? topK : Math.max(2, Math.ceil(topK / Math.min(distinctSources, 3)));

  const result: RetrievedChunk[] = [];
  const perSourceCount = new Map<string, number>();
  for (const item of scored) {
    if (result.length >= topK) break;
    const count = perSourceCount.get(item.source) ?? 0;
    if (count >= maxPerSource) continue;
    result.push(item);
    perSourceCount.set(item.source, count + 1);
  }
  // Backfill with the next-highest-scoring chunks if the cap left us short (rare).
  if (result.length < topK) {
    for (const item of scored) {
      if (result.length >= topK) break;
      if (!result.includes(item)) result.push(item);
    }
  }

  return result;
}

/**
 * "Full-Text Mode": bypasses vector retrieval entirely and hands the AI the complete text
 * of every loaded document (with heading structure restored), plus every image found across
 * them. This trades a much larger token bill for guaranteed recall — nothing gets filtered
 * out, so there's no risk of a relevant passage failing to score into the Top-K. Intended as
 * an explicit, opt-in fallback for when retrieval-based answers come back empty or wrong.
 */
export function buildFullTextChunks(docs: AppDocument[]): RetrievedChunk[] {
  const textChunks: RetrievedChunk[] = docs
    .map((d) => ({ text: renderFullText(d.blocks), source: d.name, score: 1 }))
    .filter((c) => c.text.trim().length > 0);

  const imageChunks: RetrievedChunk[] = docs.flatMap((d) =>
    d.blocks
      .filter((b) => b.image)
      .map((b) => ({
        text: b.image!.caption || b.text,
        source: d.name,
        score: 1,
        headingPath: b.headingPath,
        image: b.image,
      }))
  );

  return [...textChunks, ...imageChunks];
}

export interface IndexSourceSummary {
  source: string;
  chunkCount: number;
  imageCount: number;
  sampleText: string;
  sampleHeadingPath: string[];
  embeddingDims: number;
}

export interface IndexSummary {
  totalChunks: number;
  totalImages: number;
  fingerprint: string | null;
  sources: IndexSourceSummary[];
}

/** Reads back what's actually stored in IndexedDB, grouped by source document — for verification/debugging. */
export async function getIndexSummary(): Promise<IndexSummary> {
  const [chunks, fingerprint] = await Promise.all([getAllChunks(), getMeta(FINGERPRINT_KEY)]);

  const bySource = new Map<string, StoredChunk[]>();
  for (const chunk of chunks) {
    const list = bySource.get(chunk.source) ?? [];
    list.push(chunk);
    bySource.set(chunk.source, list);
  }

  const sources: IndexSourceSummary[] = Array.from(bySource.entries())
    .map(([source, list]) => ({
      source,
      chunkCount: list.length,
      imageCount: list.filter((c) => c.image).length,
      sampleText: list[0]?.text.slice(0, 160) ?? '',
      sampleHeadingPath: list[0]?.headingPath ?? [],
      embeddingDims: list[0]?.embedding.length ?? 0,
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  return { totalChunks: chunks.length, totalImages: chunks.filter((c) => c.image).length, fingerprint, sources };
}
