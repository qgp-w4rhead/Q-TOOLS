import fs from 'node:fs';
const vals = {
  en: 'Fix the pattern error to see matches.',
  es: 'Corrige el error del patrón para ver las coincidencias.',
  fr: "Corrigez l'erreur du motif pour voir les correspondances.",
};
for (const l of ['en', 'es', 'fr']) {
  const p = './packages/frontend/src/i18n/locales/' + l + '-tools.json';
  let s = fs.readFileSync(p, 'utf8');
  const anchor = s.indexOf('"regex-tester"');
  const k = s.indexOf('"needPattern"', anchor);
  const lineEnd = s.indexOf('\n', k);
  s = s.slice(0, lineEnd) + ',\n      "fixError": ' + JSON.stringify(vals[l]) + s.slice(lineEnd);
  fs.writeFileSync(p, s);
  console.log(l + ' done');
}
