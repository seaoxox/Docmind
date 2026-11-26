import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

function gitShortHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}

// Set base to your repo name for GitHub Pages, e.g. '/docmind-qa/'.
// If deploying to a user/org root page (username.github.io), use '/'.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/docmind-qa/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitShortHash()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('mammoth')) return 'docx';
          if (id.includes('@huggingface/transformers')) return 'embeddings';
          if (id.includes('node_modules/motion')) return 'motion';
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('mdast') || id.includes('micromark')) return 'markdown';
        },
      },
    },
  },
})
