// Report which tools have ui blocks in en-tools.json, grouped by category.
import fs from 'node:fs';

const en = JSON.parse(
  fs.readFileSync('./packages/frontend/src/i18n/locales/en-tools.json', 'utf8'),
);
const src = fs.readFileSync('./packages/frontend/src/data/tools.ts', 'utf8');
const re = /slug:\s*'([^']+)'[\s\S]*?category:\s*'([^']+)'/g;
let m;
const byCat = {};
while ((m = re.exec(src))) {
  (byCat[m[2]] = byCat[m[2]] || []).push(m[1]);
}
for (const cat of Object.keys(byCat)) {
  const done = byCat[cat].filter((s) => en.tools?.[s]?.ui);
  const todo = byCat[cat].filter((s) => !en.tools?.[s]?.ui);
  console.log(`${cat}: ${done.length}/${byCat[cat].length} done`);
  if (todo.length) console.log(`  todo: ${todo.join(', ')}`);
}
