import fs from 'node:fs';

const slugs = [
  'random-port-generator', 'crontab-generator', 'json-prettify-and-format',
  'json-minify', 'json-to-csv', 'sql-prettify-and-format', 'chmod-calculator',
  'docker-run-to-compose', 'xml-formatter', 'yaml-prettify-and-format',
  'email-normalizer', 'regex-tester',
];

for (const f of ['en-tools.json', 'es-tools.json', 'fr-tools.json']) {
  const p = './packages/frontend/src/i18n/locales/' + f;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const slug of slugs) {
    const ui = j.tools?.[slug]?.ui;
    if (!ui) continue;
    for (const [k, v] of Object.entries(ui)) {
      if (typeof v !== 'string') continue;
      // literal @ not inside {'@'} escape, and | (literal) or % (modulo) chars
      const stripped = v.replace(/\{'[@{}'%|]'\}/g, '');
      if (/[@|%]/.test(stripped)) console.log(`${f} ${slug}.${k}: ${JSON.stringify(v)}`);
    }
  }
}
console.log('scan done');
