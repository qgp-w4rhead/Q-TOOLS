import fs from 'node:fs';

const p = './packages/frontend/src/i18n/locales/en-tools.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const moves = {
  'openapi-formatter': 'openapi-spec-formatter',
  'graphql-formatter': 'graphql-query-formatter',
};
for (const [wrong, right] of Object.entries(moves)) {
  if (!j.tools[wrong]) { console.log(wrong + ' absent'); continue; }
  j.tools[right] = j.tools[wrong];
  delete j.tools[wrong];
  console.log(`renamed ${wrong} -> ${right}`);
}
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log('done');
