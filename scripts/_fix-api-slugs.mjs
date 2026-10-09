import fs from 'node:fs';

const moves = {
  'openapi-formatter': 'openapi-spec-formatter',
  'graphql-formatter': 'graphql-query-formatter',
};

for (const f of ['en-tools.json', 'es-tools.json', 'fr-tools.json']) {
  const p = './packages/frontend/src/i18n/locales/' + f;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [wrong, right] of Object.entries(moves)) {
    const w = j.tools?.[wrong];
    if (!w) { console.log(`${f}: ${wrong} absent`); continue; }
    if (!j.tools[right]) { console.log(`${f}: ${right} MISSING`); continue; }
    if (w.ui) j.tools[right].ui = w.ui;
    delete j.tools[wrong];
    console.log(`${f}: moved ui ${wrong} -> ${right}`);
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
console.log('done');
