// Key-parity check: every en key exists in es + fr (report-only, no mutation).
// Covers both the base locale files (en.json) and the per-tool files (en-tools.json).
// Usage: node scripts/check-i18n.mjs   (exit 1 when any key is missing — CI-ready)
import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve('./packages/frontend/src/i18n/locales');

const PAIRS = [
  ['en.json', 'es.json', 'fr.json'],
  ['en-tools.json', 'es-tools.json', 'fr-tools.json'],
];

const read = (f) => JSON.parse(fs.readFileSync(path.join(localesDir, f), 'utf8'));

/** Flatten nested object to dot-path -> value (leaf strings only). */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

let totalMissing = 0;

for (const [enFile, esFile, frFile] of PAIRS) {
  const en = flatten(read(enFile));
  const targets = [
    ['es', flatten(read(esFile))],
    ['fr', flatten(read(frFile))],
  ];

  for (const [locale, msgs] of targets) {
    const missing = Object.keys(en).filter((k) => !(k in msgs));
    if (missing.length === 0) {
      console.log(`${locale} (${enFile} -> ${locale === 'es' ? esFile : frFile}): OK (${Object.keys(en).length} keys)`);
      continue;
    }
    totalMissing += missing.length;
    console.log(`\n${locale} MISSING ${missing.length} key(s) in ${locale === 'es' ? esFile : frFile}:`);
    for (const k of missing) console.log(`  - ${k}`);
  }
}

console.log(totalMissing === 0 ? '\nKEY PARITY: ALL PRESENT' : `\nKEY PARITY: ${totalMissing} missing`);
process.exit(totalMissing === 0 ? 0 : 1);
