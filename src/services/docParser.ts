import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';
import { extToDocType, uid } from '../lib/utils';
import type { AppDocument, ContentBlock, DocCategory } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HEADING_TAG = /^H([1-6])$/i;
const CAPTION_PATTERN = /^(圖|表|附圖|附表|Fig(?:ure)?\.?|Table)\s*[\d一二三四五六七八九十]/i;

/**
 * Walks Word's converted HTML (headings, paragraphs, list items, images) in document order,
 * tracking which heading each block currently falls under. This preserves the document's
 * real structure — which mammoth's plain-text extraction throws away — so chunking can
 * respect section boundaries instead of guessing from blank lines.
 *
 * Images are captured too (mammoth embeds them as base64 data URIs by default). Since we
 * have no way to visually understand a diagram at index time without an AI call — which
 * would break "building the index needs no API key" — each image is instead paired with
 * its caption (the very next paragraph, if it looks like "圖3-1 ..." / "表2 ..." etc.).
 * The image is only actually shown to the AI later, at question time, if its caption/heading
 * context is what got semantically matched to the user's question — see aiService.ts.
 */
function blocksFromHtml(html: string): ContentBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: ContentBlock[] = [];
  const headingStack: string[] = [];
  const topLevel = Array.from(doc.body.children);

  const pushText = (text: string) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed) blocks.push({ headingPath: headingStack.filter(Boolean), text: trimmed });
  };

  for (let i = 0; i < topLevel.length; i++) {
    const el = topLevel[i];
    const headingMatch = el.tagName.match(HEADING_TAG);

    if (headingMatch) {
      const level = Number(headingMatch[1]);
      headingStack.length = Math.max(0, level - 1);
      const title = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (title) headingStack[level - 1] = title;
      continue;
    }

    if (el.tagName === 'UL' || el.tagName === 'OL') {
      for (const li of Array.from(el.children)) {
        if (li.tagName === 'LI') pushText(li.textContent ?? '');
      }
      continue;
    }

    if (el.tagName === 'P') {
      const img = el.querySelector('img');
      if (img) {
        const dataUrl = img.getAttribute('src') ?? '';
        const next = topLevel[i + 1];
        const nextText = next?.tagName === 'P' ? (next.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
        const caption = CAPTION_PATTERN.test(nextText) ? nextText : '';

        if (dataUrl) {
          blocks.push({
            headingPath: headingStack.filter(Boolean),
            text: caption || '[圖片]',
            image: { dataUrl, caption },
          });
        }
        if (caption) {
          // Keep the caption as its own normal searchable text block too, and skip it
          // on the next loop iteration since we've already consumed it here.
          pushText(nextText);
          i++;
        }
        continue;
      }
      pushText(el.textContent ?? '');
      continue;
    }

    if (el.tagName === 'TABLE') {
      pushText(el.textContent ?? '');
      continue;
    }

    // Unknown/wrapper element: fall back to its flattened text rather than dropping it.
    pushText(el.textContent ?? '');
  }

  return blocks;
}

async function parseDocxStructured(buffer: ArrayBuffer): Promise<ContentBlock[]> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return blocksFromHtml(result.value);
}

/** Parses Markdown headings (# .. ######) into a heading path, one block per paragraph. */
function blocksFromMarkdown(text: string): ContentBlock[] {
  const headingStack: string[] = [];
  const blocks: ContentBlock[] = [];
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const para of paragraphs) {
    const lines = para.split('\n');
    const bodyLines: string[] = [];
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        headingStack.length = Math.max(0, level - 1);
        headingStack[level - 1] = headingMatch[2].trim();
      } else if (line.trim()) {
        bodyLines.push(line.trim());
      }
    }
    const body = bodyLines.join(' ').trim();
    if (body) blocks.push({ headingPath: headingStack.filter(Boolean), text: body });
  }
  return blocks;
}

/** Fallback for formats without structural markup (PDF, plain text): split on blank lines. */
function blocksFromPlainText(text: string): ContentBlock[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ headingPath: [], text: p }));
}

async function parsePdfBlocks(buffer: ArrayBuffer): Promise<ContentBlock[]> {
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(text);
  }
  return blocksFromPlainText(pages.join('\n\n'));
}

function flattenBlocks(blocks: ContentBlock[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}

/** Fetch + parse a bundled file (served as a static asset next to index.html). */
export async function parseFromUrl(url: string, name: string, category: DocCategory): Promise<AppDocument> {
  const type = extToDocType(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`無法載入文件: ${name} (${res.status})`);

  let blocks: ContentBlock[];
  if (type === 'word') {
    blocks = await parseDocxStructured(await res.arrayBuffer());
  } else if (type === 'pdf') {
    blocks = await parsePdfBlocks(await res.arrayBuffer());
  } else if (type === 'markdown') {
    blocks = blocksFromMarkdown(await res.text());
  } else {
    blocks = blocksFromPlainText(await res.text());
  }

  const content = flattenBlocks(blocks);

  return {
    id: uid('doc'),
    name,
    content,
    blocks,
    type,
    category,
    sizeChars: content.length,
  };
}
