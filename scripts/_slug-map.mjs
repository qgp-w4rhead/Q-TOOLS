// Print slug -> component dir for a category (arg1 = category).
import fs from 'node:fs';
import path from 'node:path';

const cat = process.argv[2];
const src = fs.readFileSync('./packages/frontend/src/data/tools.ts', 'utf8');
const re = /slug:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'/g;
let m;
const slugs = [];
while ((m = re.exec(src))) {
  if (m[2] === cat) slugs.push(m[1]);
}
const dir = './packages/frontend/src/tools';
const map = {};
for (const d of fs.readdirSync(dir)) {
  const p = path.join(dir, d);
  if (!fs.statSync(p).isDirectory()) continue;
  const ts = path.join(p, 'index.ts');
  if (fs.existsSync(ts)) {
    const c = fs.readFileSync(ts, 'utf8');
    const mm = c.match(/slug:\s*'([^']+)'/);
    if (mm) map[mm[1]] = d;
  }
}
for (const s of slugs) console.log(`${s} -> ${map[s] ?? '??'}`);
