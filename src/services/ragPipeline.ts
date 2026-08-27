import type { AppDocument, Manifest, RetrievedChunk } from '../types';
import { chunkDocumentsHierarchical, renderFullText, toEmbeddingText } from './chunking';
import { embedQuery, embedTexts, type EmbeddingProgress } from './embeddingService';
import {
  clearChunks,
  clearParents,
  countChunks,
  getAllChunks,
  getAllParents,
  getMeta,
  putChunks,
  putParents,
  setMeta,
  type StoredChunk,
  type StoredParent,
} from './vectorStore';
import { uid } from '../lib/utils';

const FINGERPRINT_KEY = 'guidance-fingerprint';
// Bumped whenever the on-disk chunk/parent shape changes (e.g. adding Parent-Child fields) —
// forces a rebuild even if manifest.json didn't change, since an old-format index wouldn't
// have the fields the current code expects to read.
const SCHEMA_VERSION = '2-parent-child';
const SCHEMA_VERSION_KEY = 'schema-version';
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

let cachedChildren: StoredChunk[] | null = null;
let cachedParents: Map<string, StoredParent> | null = null;

async function ensureCachesLoaded(): Promise<void> {
  if (!cachedChildren) cachedChildren = await getAllChunks();
  if (!cachedParents) {
    const parents = await getAllParents();
    cachedParents = new Map(parents.map((p) => [p.id, p]));
  }
}

/**
 * Ensures the local vector index reflects the current set of guidance/manual documents, using
 * two-level "Parent-Child" chunking: small child chunks get embedded and matched against
 * queries (precise), but each child points back to a larger parent section, which is what
 * actually gets returned to the AI (full context). On first run (or whenever manifest.json
 * indicates the underlying documents have changed, or the storage schema was upgraded), this
 * re-chunks every document and re-embeds all children. On subsequent unchanged runs, it's a
 * fast no-op.
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
  const storedSchemaVersion = await getMeta(SCHEMA_VERSION_KEY);
  const existingCount = await countChunks();
  const schemaMatches = storedSchemaVersion === SCHEMA_VERSION;

  if (!forceRebuild && schemaMatches && existingCount > 0 && (fingerprint === null || storedFingerprint === fingerprint)) {
    cachedChildren = null; // will lazy-load from IndexedDB on first search
    cachedParents = null;
    onStatus({ phase: 'ready', chunkCount: existingCount });
    return;
  }

  try {
    await clearChunks();
    await clearParents();
    const { parents, children } = chunkDocumentsHierarchical(docs.map((d) => ({ blocks: d.blocks, name: d.name })));

    if (children.length === 0) {
      if (fingerprint !== null) await setMeta(FINGERPRINT_KEY, fingerprint);
      await setMeta(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
      onStatus({ phase: 'ready', chunkCount: 0 });
      return;
    }

    await putParents(
      parents.map((p) => ({ id: p.id, text: p.text, source: p.source, headingPath: p.headingPath, image: p.image }))
    );

    const BATCH_SIZE = 16;
    for (let i = 0; i < children.length; i += BATCH_SIZE) {
      const batch = children.slice(i, i + BATCH_SIZE);
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
            onStatus({ phase: 'embedding', done: i, total: children.length, currentSource });
          }
        }
      );
      const newlyStored: StoredChunk[] = batch.map((c, idx) => ({
        id: uid('child'),
        text: c.text,
        source: c.source,
        embedding: vectors[idx],
        headingPath: c.headingPath,
        image: c.image,
        parentId: c.parentId,
      }));
      await putChunks(newlyStored);
      onStatus({ phase: 'embedding', done: Math.min(i + BATCH_SIZE, children.length), total: children.length, currentSource });
    }

    if (fingerprint !== null) await setMeta(FINGERPRINT_KEY, fingerprint);
    await setMeta(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
    cachedChildren = null;
    cachedParents = null;
    onStatus({ phase: 'ready', chunkCount: children.length });
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
 * Searches with multiple query variants at once ("Parent-Child" retrieval): small CHILD
 * chunks are what get matched against the query/queries — scored by their BEST similarity
 * across any of them — but each match is immediately expanded to its larger PARENT section
 * before being returned, so the AI sees full context instead of an isolated fragment. The
 * usual per-source diversity cap is then applied at the (now-deduplicated) parent level.
 *
 * This is also what makes query rewriting safe: if a rewritten query drifts off-target, the
 * original question's matches are still considered. Optional per-query `weights` (same
 * length/order as `queries`) scale each query's similarity before the max is taken — used to
 * down-weight rewritten queries, since a degenerate rewrite (e.g. "結核" instead of a full
 * question) can score unrealistically high against nearly every chunk in a corpus that's
 * *about* tuberculosis, which would otherwise let it silently outrank the original question.
 */
export async function searchMulti(
  queries: string[],
  topK: number = TOP_K,
  weights?: number[]
): Promise<RetrievedChunk[]> {
  await ensureCachesLoaded();
  const children = cachedChildren!;
  const parentsById = cachedParents!;

  const pairs = queries
    .map((q, i) => ({ q: q.trim(), w: weights?.[i] ?? 1 }))
    .filter((p) => p.q.length > 0);
  if (children.length === 0 || pairs.length === 0) return [];

  const queryVecs = await Promise.all(pairs.map((p) => embedQuery(p.q)));

  const scoredChildren = children
    .map((c) => {
      let best = -Infinity;
      for (let i = 0; i < queryVecs.length; i++) {
        const s = cosineSimilarity(queryVecs[i], c.embedding) * pairs[i].w;
        if (s > best) best = s;
      }
      return { child: c, score: best };
    })
    .sort((a, b) => b.score - a.score);

  // Small-to-big expansion: walk children best-first, expand each to its parent, and keep
  // only the first (highest-scoring) hit per distinct parent.
  const seenParents = new Set<string>();
  const candidates: RetrievedChunk[] = [];
  for (const { child, score } of scoredChildren) {
    if (seenParents.has(child.parentId)) continue;
    const parent = parentsById.get(child.parentId);
    if (!parent) continue;
    seenParents.add(child.parentId);
    candidates.push({
      text: parent.text,
      source: parent.source,
      headingPath: parent.headingPath,
      image: parent.image,
      score,
      matchedText: child.text,
    });
  }

  const distinctSources = new Set(candidates.map((c) => c.source)).size;
  // With few distinct sources, a stricter cap would just force in irrelevant filler —
  // only diversify meaningfully once there's more than one source to diversify across.
  const maxPerSource = distinctSources <= 1 ? topK : Math.max(2, Math.ceil(topK / Math.min(distinctSources, 3)));

  const result: RetrievedChunk[] = [];
  const perSourceCount = new Map<string, number>();
  for (const item of candidates) {
    if (result.length >= topK) break;
    const count = perSourceCount.get(item.source) ?? 0;
    if (count >= maxPerSource) continue;
    result.push(item);
    perSourceCount.set(item.source, count + 1);
  }
  // Backfill with the next-highest-scoring parents if the cap left us short (rare).
  if (result.length < topK) {
    for (const item of candidates) {
      if (result.length >= topK) break;
      if (!result.includes(item)) result.push(item);
    }
  }

  return result;
}

export async function search(query: string, topK: number = TOP_K): Promise<RetrievedChunk[]> {
  return searchMulti([query], topK);
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
  parentCount: number;
  imageCount: number;
  sampleText: string;
  sampleHeadingPath: string[];
  embeddingDims: number;
}

export interface IndexSummary {
  totalChunks: number;
  totalParents: number;
  totalImages: number;
  fingerprint: string | null;
  sources: IndexSourceSummary[];
}

/** Reads back what's actually stored in IndexedDB, grouped by source document — for verification/debugging. */
export async function getIndexSummary(): Promise<IndexSummary> {
  const [children, parents, fingerprint] = await Promise.all([getAllChunks(), getAllParents(), getMeta(FINGERPRINT_KEY)]);

  const bySource = new Map<string, { children: StoredChunk[]; parents: StoredParent[] }>();
  for (const c of children) {
    const entry = bySource.get(c.source) ?? { children: [], parents: [] };
    entry.children.push(c);
    bySource.set(c.source, entry);
  }
  for (const p of parents) {
    const entry = bySource.get(p.source) ?? { children: [], parents: [] };
    entry.parents.push(p);
    bySource.set(p.source, entry);
  }

  const sources: IndexSourceSummary[] = Array.from(bySource.entries())
    .map(([source, entry]) => ({
      source,
      chunkCount: entry.children.length,
      parentCount: entry.parents.length,
      imageCount: entry.children.filter((c) => c.image).length,
      sampleText: (entry.parents[0]?.text ?? entry.children[0]?.text ?? '').slice(0, 160),
      sampleHeadingPath: entry.parents[0]?.headingPath ?? entry.children[0]?.headingPath ?? [],
      embeddingDims: entry.children[0]?.embedding.length ?? 0,
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  return {
    totalChunks: children.length,
    totalParents: parents.length,
    totalImages: children.filter((c) => c.image).length,
    fingerprint,
    sources,
  };
}
