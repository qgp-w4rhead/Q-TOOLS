import fs from 'node:fs';
for (const loc of ['en', 'es', 'fr']) {
  const p = `./packages/frontend/src/i18n/locales/${loc}-tools.json`;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = s
    .replace(/user@host/g, "user{'@'}host")
    .replace(/usuario@host/g, "usuario{'@'}host")
    .replace(/user@example\.com/g, "user{'@'}example.com")
    .replace(/usuario@example\.com/g, "usuario{'@'}example.com");
  if (s !== before) { fs.writeFileSync(p, s); console.log(`${loc}: fixed`); }
  else { console.log(`${loc}: no match`); }
}
