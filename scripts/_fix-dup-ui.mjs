// One-off: replace (not append) `ui` blocks for slugs in a data file.
// Removes any duplicate "ui" keys left by re-running i18n-inject-ui.mjs.
import fs from 'node:fs';
import path from 'node:path';

const dataFile = process.argv[2] || './scripts/i18n-ui-devops.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const locDir = path.resolve('./packages/frontend/src/i18n/locales');

function renderUi(ui) {
  const lines = ['      "ui": {'];
  const keys = Object.keys(ui);
  keys.forEach((k, i) => {
    const v = ui[k];
    const comma = i < keys.length - 1 ? ',' : '';
    if (v && typeof v === 'object') {
      lines.push(`        "${k}": {`);
      const sub = Object.keys(v);
      sub.forEach((sk, j) => {
        const sc = j < sub.length - 1 ? ',' : '';
        lines.push(`          ${JSON.stringify(sk)}: ${JSON.stringify(v[sk])}${sc}`);
      });
      lines.push(`        }${comma}`);
    } else {
      lines.push(`        ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
    }
  });
  lines.push('      }');
  return lines.join('\n');
}

for (const locale of Object.keys(data)) {
  const file = path.join(locDir, `${locale}-tools.json`);
  let src = fs.readFileSync(file, 'utf8');
  for (const slug of Object.keys(data[locale])) {
    const anchor = `    "${slug}": {`;
    const ai = src.indexOf(anchor);
    if (ai === -1) throw new Error(`no ${slug} in ${file}`);
    const close = src.indexOf('\n    }', ai);
    if (close === -1) throw new Error(`no close for ${slug} in ${file}`);
    let block = src.slice(ai, close);
    // Strip every ui block inside the slug span (flat ui objects only).
    block = block.replace(/\n      "ui": \{[\s\S]*?\n      \}/g, '');
    // Drop leftover commas/whitespace at the tail.
    block = block.replace(/[,\s]+$/, '');
    const uiBlock = renderUi(data[locale][slug]);
    block += block.endsWith('{') ? '\n' + uiBlock : ',\n' + uiBlock;
    src = src.slice(0, ai) + block + src.slice(close);
  }
  JSON.parse(src);
  fs.writeFileSync(file, src);
  console.log(`${locale}: fixed`);
}
console.log('done');
