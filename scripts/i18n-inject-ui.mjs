// Inject `ui` blocks into *-tools.json locale files without reformatting.
// - en: media tools have no entry -> create `tools.<slug> = { ui }`.
// - es/fr: tools already have name/desc/keywords -> add `ui` to the block.
// Usage: node scripts/i18n-inject-ui.mjs <dataFile.json>
import fs from 'node:fs';
import path from 'node:path';

const dataFile = process.argv[2] || './scripts/i18n-ui-media.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const locDir = path.resolve('./packages/frontend/src/i18n/locales');

// Render a `ui` object at indent level 6 (its keys at 8), matching file style.
function renderUi(ui) {
  const lines = ['      "ui": {'];
  const keys = Object.keys(ui);
  keys.forEach((k, i) => {
    const v = ui[k];
    const comma = i < keys.length - 1 ? ',' : '';
    if (v && typeof v === 'object') {
      // nested map (e.g. groups)
      lines.push(`        "${k}": {`);
      const sub = Object.keys(v);
      sub.forEach((sk, j) => {
        const sc = j < sub.length - 1 ? ',' : '';
        lines.push(`          ${JSON.stringify(sk)}: ${JSON.stringify(v[sk])}${sc}`);
      });
      lines.push(`        }${comma}`);
    } else {
      lines.push(`        ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
    }
  });
  lines.push('      }');
  return lines.join('\n');
}

for (const locale of Object.keys(data)) {
  const file = path.join(locDir, `${locale}-tools.json`);
  let src = fs.readFileSync(file, 'utf8');
  const tools = data[locale];
  for (const slug of Object.keys(tools)) {
    const uiBlock = renderUi(tools[slug]);
    const anchor = `"${slug}": {`;
    const ai = src.indexOf(anchor);
    if (ai === -1) {
      // New entry: append before the tools object's closing "\n  }\n}".
      const tail = src.lastIndexOf('\n  }');
      if (tail === -1) throw new Error(`no tools close in ${file}`);
      const entry = `,\n    "${slug}": {\n${uiBlock}\n    }`;
      src = src.slice(0, tail) + entry + src.slice(tail);
      console.log(`${locale}: +new ${slug}`);
    } else {
      // Existing entry: insert ui before the slug block's closing "\n    }".
      const close = src.indexOf('\n    }', ai);
      if (close === -1) throw new Error(`no close for ${slug} in ${file}`);
      src = src.slice(0, close) + ',\n' + uiBlock + src.slice(close);
      console.log(`${locale}: +ui ${slug}`);
    }
  }
  // Validate JSON still parses.
  JSON.parse(src);
  fs.writeFileSync(file, src);
}
console.log('done');
