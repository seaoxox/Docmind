// 最小驗證用:把單一 PDF 解析成 chunks.json(依頁碼與條文標題切段)。
// 用法: PDFJS=<pdfjs legacy pdf.mjs 絕對路徑> node build-chunks.mjs <input.pdf> <out.json>
import fs from 'node:fs';
const { getDocument } = await import(process.env.PDFJS);
const [, , input, out] = process.argv;
const data = new Uint8Array(fs.readFileSync(input));
const pdf = await getDocument({ data, useSystemFonts: true }).promise;

const pages = [];
for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);
  const content = await page.getTextContent();
  let line = '', lines = [], lastY = null;
  for (const it of content.items) {
    const y = Math.round(it.transform[5]);
    if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(line); line = ''; }
    line += it.str; lastY = y;
    if (it.hasEOL) { lines.push(line); line = ''; lastY = null; }
  }
  if (line) lines.push(line);
  pages.push(lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean));
}

const MAX = 700;
const chunks = [];
let buf = '', startPage = 1, heading = '';
const HEAD = /^(第?[一二三四五六七八九十]+[、章節]|[壹貳參肆伍陸柒捌玖拾]+、|\d+\.\d*\s|[（(][一二三四五六七八九十]+[）)])/;
const flush = (page) => {
  if (buf.trim()) chunks.push({ id: chunks.length, page: startPage, endPage: page, heading, text: buf.trim() });
  buf = ''; startPage = page;
};
pages.forEach((lines, i) => {
  const page = i + 1;
  if (!buf) startPage = page;
  for (const l of lines) {
    if (HEAD.test(l) && l.length < 40) { if (buf.length > 250) flush(page); heading = l; if (!buf) startPage = page; }
    if ((buf + l).length > MAX) { flush(page); startPage = page; }
    buf += (buf ? '\n' : '') + l;
  }
});
flush(pages.length);
fs.writeFileSync(out, JSON.stringify({ pageCount: pdf.numPages, chunks }));
console.log('pages', pdf.numPages, 'chunks', chunks.length, 'chars', chunks.reduce((a, c) => a + c.text.length, 0));
