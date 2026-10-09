// One-off: drop web-tool ui keys that exactly duplicate common.* (en/es/fr).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('./packages/frontend/src/i18n/locales');

// Top-level ui keys (8-space indent) that duplicate common.* — removed per slug.
const redundant = {
  'url-encode-decode': ['inputTitle', 'swap', 'swapTitle', 'direction', 'encode', 'decode', 'labelText', 'empty', 'copyResult'],
  'escape-html-entities': ['inputTitle', 'swap', 'swapTitle', 'direction', 'labelText', 'empty', 'copyResult'],
  'device-information': ['copyAll', 'copied'],
  'otp-code-generator': ['generate'],
  'keycode-info': ['clear', 'copied'],
  'slugify-string': ['inputTitle', 'placeholder', 'chars', 'words', 'lines'],
  'html-wysiwyg-editor': ['outputTitle'],
  'user-agent-parser': ['copyAll', 'copied'],
  'json-diff': ['swap'],
};

for (const file of ['en-tools.json', 'es-tools.json', 'fr-tools.json']) {
  const fp = path.join(dir, file);
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  let removed = 0;
  for (const [slug, keys] of Object.entries(redundant)) {
    if (!keys.length) continue;
    const slugIdx = lines.findIndex((l) => l.trim() === `"${slug}": {`);
    if (slugIdx < 0) { console.log(`${file}: MISSING ${slug}`); continue; }
    const uiIdx = lines.findIndex((l, i) => i > slugIdx && l.trim() === '"ui": {');
    if (uiIdx < 0) { console.log(`${file}: NO ui in ${slug}`); continue; }
    let uiEnd = -1;
    for (let i = uiIdx + 1; i < lines.length; i++) {
      if (lines[i] === '      }' || lines[i] === '      },') { uiEnd = i; break; }
    }
    if (uiEnd < 0) { console.log(`${file}: NO ui end in ${slug}`); continue; }
    for (let i = uiEnd - 1; i > uiIdx; i--) {
      const m = lines[i].match(/^        "([A-Za-z0-9]+)":/); // exactly 8-space indent = top-level ui key
      if (m && keys.includes(m[1])) { lines.splice(i, 1); uiEnd--; removed++; }
    }
  }
  fs.writeFileSync(fp, lines.join('\n'));
  // validate JSON
  JSON.parse(fs.readFileSync(fp, 'utf8'));
  console.log(`${file}: removed ${removed} keys, JSON OK`);
}
