import fs from 'node:fs';

const slugs = [
  'random-port-generator', 'crontab-generator', 'json-prettify-and-format',
  'json-minify', 'json-to-csv', 'sql-prettify-and-format', 'chmod-calculator',
  'docker-run-to-compose', 'xml-formatter', 'yaml-prettify-and-format',
  'email-normalizer', 'regex-tester',
];
// valid interpolation params used in dev ui blocks
const okParams = new Set(['n', 'line', 'col', 'min', 'max', 'unit', 'v', 'token', 'sign', 'pct', 'mode']);

for (const f of ['en-tools.json', 'es-tools.json', 'fr-tools.json']) {
  const p = './packages/frontend/src/i18n/locales/' + f;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const slug of slugs) {
    const ui = j.tools?.[slug]?.ui;
    if (!ui) continue;
    for (const [k, v] of Object.entries(ui)) {
      if (typeof v !== 'string') continue;
      const bad = [];
      for (const m of v.matchAll(/\{([^{}]*)\}/g)) {
        if (!okParams.has(m[1])) bad.push(m[0]);
      }
      // unbalanced braces
      const stripped = v.replace(/\{[^{}]*\}/g, '');
      if (/[{}]/.test(stripped)) bad.push('UNBALANCED');
      if (bad.length) console.log(`${f} ${slug}.${k}: ${JSON.stringify(v)}  -> ${bad.join(', ')}`);
    }
  }
}
console.log('scan done');
