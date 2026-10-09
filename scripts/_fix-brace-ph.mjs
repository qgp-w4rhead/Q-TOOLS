import fs from 'node:fs';

// Keys whose values contain literal { } that must be escaped for vue-i18n.
const targets = [
  'curl-command-builder.phBody',
  'http-request-tester.phBody',
  'openapi-formatter.phSpec',
  'graphql-formatter.phQuery',
  'webhook-payload-inspector.phPayload',
  'mock-response-generator.phInput',
  'json-schema-validator.phSchema',
  'json-schema-validator.phInstance',
];

const escapeBraces = (s) =>
  [...s].map((ch) => (ch === '{' ? "{'{'}" : ch === '}' ? "{'}'}" : ch)).join('');

for (const f of ['en-tools.json', 'es-tools.json', 'fr-tools.json']) {
  const p = './packages/frontend/src/i18n/locales/' + f;
  let s = fs.readFileSync(p, 'utf8');
  for (const t of targets) {
    const [slug, key] = t.split('.');
    const anchor = s.indexOf('"' + slug + '"');
    if (anchor === -1) { console.log(f + ': slug not found ' + slug); continue; }
    const keyIdx = s.indexOf('"' + key + '"', anchor);
    if (keyIdx === -1) { console.log(f + ': key not found ' + t); continue; }
    const lineStart = s.lastIndexOf('\n', keyIdx) + 1;
    const lineEnd = s.indexOf('\n', keyIdx);
    const line = s.slice(lineStart, lineEnd);
    const m = line.match(/^(\s*)"([^"]+)":\s*"(.*)",?\s*$/);
    if (!m) { console.log(f + ': no match ' + t); continue; }
    const raw = JSON.parse('"' + m[3] + '"');
    const esc = escapeBraces(raw);
    const newline = m[1] + '"' + m[2] + '": ' + JSON.stringify(esc) + (line.trimEnd().endsWith(',') ? ',' : '');
    s = s.slice(0, lineStart) + newline + s.slice(lineEnd);
    console.log(f + ': ' + t + ' -> ' + esc);
  }
  fs.writeFileSync(p, s);
}
console.log('done');
