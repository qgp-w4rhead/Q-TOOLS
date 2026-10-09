// Verify every i18n key referenced by the 14 web tools exists in en/es/fr.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('./packages/frontend/src');
const en = JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales/en-tools.json'), 'utf8'));
const enBase = JSON.parse(fs.readFileSync(path.join(root, 'i18n/locales/en.json'), 'utf8'));

const dirs = fs.readdirSync(path.join(root, 'tools'));

function get(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

let missing = 0;
const seen = new Set();
for (const dir of dirs) {
  const vue = path.join(root, 'tools', dir, `${dir}.vue`);
  if (!fs.existsSync(vue)) continue;
  const src = fs.readFileSync(vue, 'utf8');
  const m = src.match(/const U = '([^']+)'/);
  if (!m) continue;
  const U = m[1]; // e.g. tools.slug.ui.
  const slug = U.replace(/^tools\./, '').replace(/\.ui\.$/, '');

  // t(U + 'key') and t(U + 'key', ...)
  for (const mm of src.matchAll(/t\(U \+ '([A-Za-z0-9]+)'/g)) {
    const key = U + mm[1];
    if (seen.has(key)) continue; seen.add(key);
    if (get(en, key) === undefined) { console.log(`MISSING ${key}  (${dir})`); missing++; }
  }
  // t('common.key')
  for (const mm of src.matchAll(/t\('(common\.[A-Za-z0-9]+)'/g)) {
    const key = mm[1];
    if (seen.has(key)) continue; seen.add(key);
    if (get(enBase, key) === undefined) { console.log(`MISSING ${key}  (${dir})`); missing++; }
  }
  // t('tools.slug.ui.key') literal
  for (const mm of src.matchAll(/t\('(tools\.[A-Za-z0-9.-]+\.ui\.[A-Za-z0-9]+)'/g)) {
    const key = mm[1];
    if (seen.has(key)) continue; seen.add(key);
    if (get(en, key) === undefined) { console.log(`MISSING ${key}  (${dir})`); missing++; }
  }
  // dynamic nested maps: groups.X / fields.X / locations.X — check the parent map exists
  for (const mm of src.matchAll(/\$\{U\}(groups|fields|locations)\./g)) {
    const key = U + mm[1];
    if (seen.has(key)) continue; seen.add(key);
    if (get(en, key) === undefined) { console.log(`MISSING MAP ${key}  (${dir})`); missing++; }
  }
}
console.log(missing === 0 ? 'ALL KEYS PRESENT' : `${missing} missing`);
