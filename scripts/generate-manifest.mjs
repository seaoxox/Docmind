// Scans public/guidance_docs and writes public/manifest.json, which the front end fetches
// at runtime to know which bundled documents are available as static files (used to build
// the local vector index).
//
// File sizes are captured here at BUILD TIME (not measured from a runtime fetch), so the
// vector-index "has anything changed?" fingerprint stays stable even when a CDN edge node
// or the browser's HTTP cache briefly serves a stale copy of a document body after
// deployment — manifest.json itself is always fetched with cache: 'no-store', so it's the
// one source of truth we can trust to detect real content changes.
//
// Note: public/guidance_categories.json (which groups these files into named guideline
// categories, e.g. "結核病指引") is a separate, hand-maintained file — it is NOT generated
// by this script, since categorization is a curatorial decision, not something derivable
// from the filesystem.
//
// Run automatically via `npm run build` (see package.json "prebuild" script),
// or manually with `node scripts/generate-manifest.mjs`.

import { readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PUBLIC = join(ROOT, 'public');

const SKIP = new Set(['.gitkeep', '.DS_Store']);

function listFilesWithSize(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !SKIP.has(f))
    .map((name) => ({ name, stat: statSync(join(dir, name)) }))
    .filter(({ stat }) => stat.isFile())
    .map(({ name, stat }) => ({ name, bytes: stat.size }));
}

const manifest = {
  guidanceFiles: listFilesWithSize(join(PUBLIC, 'guidance_docs')).sort((a, b) => a.name.localeCompare(b.name)),
};

writeFileSync(join(PUBLIC, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`manifest.json generated: ${manifest.guidanceFiles.length} guidance file(s).`);
