// 把 chunks.json 嵌入 template.html,輸出可發佈的 index.html
import fs from 'node:fs';
const [, , chunksPath, out] = process.argv;
const json = fs.readFileSync(chunksPath, 'utf8').replace(/<\//g, '<\\/');
fs.writeFileSync(out, fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8').replace('__DATA__', () => json));
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
