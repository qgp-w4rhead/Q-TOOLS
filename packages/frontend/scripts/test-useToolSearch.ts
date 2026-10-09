/**
 * Pure-logic tests for useToolSearch helpers.
 *
 * Run via: pnpm --filter frontend exec tsx scripts/test-useToolSearch.ts
 *
 * Tests cover: tokenizeQuery, rankedSearch (scoring + ordering + empty),
 * recent-search storage (save/remove/clear/cap/dedupe), and suggestions.
 */
import assert from 'node:assert/strict';
import {
  tokenizeQuery,
  rankedSearch,
  loadRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  getSuggestedTools,
  RECENT_MAX,
} from '../src/composables/useToolSearch';

/* ---- localStorage mock (Node.js has no native localStorage) ---- */
class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}
(globalThis as unknown as { localStorage: LocalStorageMock }).localStorage =
  new LocalStorageMock();

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
  }
}

/* ---- tokenizeQuery ---- */
test('tokenizeQuery: empty → []', () => {
  assert.deepEqual(tokenizeQuery(''), []);
  assert.deepEqual(tokenizeQuery('   '), []);
});

test('tokenizeQuery: single term lowercased', () => {
  assert.deepEqual(tokenizeQuery('Hash'), ['hash']);
});

test('tokenizeQuery: multiple terms split + deduped', () => {
  assert.deepEqual(tokenizeQuery('  Hash  hash TEXT  '), ['hash', 'text']);
});

test('tokenizeQuery: preserves internal characters', () => {
  assert.deepEqual(tokenizeQuery('base64 url-safe'), ['base64', 'url-safe']);
});

/* ---- rankedSearch: empty query ---- */
test('rankedSearch: empty query returns all tools (score 0)', () => {
  const results = rankedSearch('');
  assert.ok(results.length > 50, `expected many tools, got ${results.length}`);
  for (const r of results) {
    assert.equal(r.score, 0);
    assert.equal(r.matchedFields.length, 0);
    assert.ok(r.categoryLabel.length > 0);
  }
});

test('rankedSearch: whitespace-only query returns all tools', () => {
  const results = rankedSearch('   ');
  assert.ok(results.length > 50);
});

/* ---- rankedSearch: scoring + ordering ---- */
test('rankedSearch: name exact match scores highest', () => {
  // "Bcrypt" is a single-word tool name → exact match (score 100).
  const results = rankedSearch('bcrypt');
  const top = results[0];
  assert.ok(top, 'expected at least one result');
  assert.equal(top.tool.slug, 'bcrypt');
  assert.ok(top.score >= 100, `score ${top.score} should be >= 100`);
  assert.ok(top.matchedFields.includes('name'));
});

test('rankedSearch: name prefix ranks above substring', () => {
  const results = rankedSearch('base64');
  // Both "Base64 string encoder/decoder" and "Base64 file converter" match.
  assert.ok(results.length >= 2, `expected >= 2 results, got ${results.length}`);
  // Top results should be the base64 tools.
  const slugs = results.slice(0, 2).map((r) => r.tool.slug);
  assert.ok(slugs.includes('base64-string'));
  assert.ok(slugs.includes('base64-file-converter'));
});

test('rankedSearch: keyword match surfaces relevant tools', () => {
  const results = rankedSearch('sha256');
  // Hash text has sha256 keyword.
  const found = results.find((r) => r.tool.slug === 'hash-text');
  assert.ok(found, 'hash-text should match "sha256"');
  assert.ok(found.matchedFields.includes('keywords'));
});

test('rankedSearch: category label match', () => {
  const results = rankedSearch('crypto');
  // All crypto-category tools should match via category id.
  assert.ok(results.length >= 10, `expected >= 10 crypto tools, got ${results.length}`);
  for (const r of results.slice(0, 11)) {
    assert.equal(r.tool.category, 'crypto');
  }
});

test('rankedSearch: category label "Network" matches "network"', () => {
  const results = rankedSearch('network');
  assert.ok(results.length >= 6);
  // Network-category tools should be present (matched via category id/label).
  const networkResults = results.filter((r) => r.tool.category === 'network');
  assert.ok(networkResults.length >= 6, `expected >= 6 network tools, got ${networkResults.length}`);
});

test('rankedSearch: multi-term query requires all terms to match', () => {
  // "json yaml" - tools matching BOTH should rank highest.
  const results = rankedSearch('json yaml');
  assert.ok(results.length > 0);
  // TOML to YAML and YAML to TOML and JSON to YAML etc. should appear.
  const slugs = results.map((r) => r.tool.slug);
  assert.ok(slugs.includes('json-to-yaml') || slugs.includes('yaml-to-json'),
    'expected a json↔yaml converter in results');
});

test('rankedSearch: no matches returns empty array', () => {
  const results = rankedSearch('zzznonexistenttoolxyz');
  assert.equal(results.length, 0);
});

test('rankedSearch: description substring match', () => {
  // "phonetic" is both a keyword and in the description of text-to-nato;
  // use a term that only appears in a description to isolate the field.
  const results = rankedSearch('placeholder');
  const lorem = results.find((r) => r.tool.slug === 'lorem-ipsum-generator');
  assert.ok(lorem, 'lorem-ipsum-generator should match "placeholder"');
  // "placeholder" is a keyword of lorem-ipsum, so it matches via keywords.
  assert.ok(lorem.matchedFields.length > 0);
});

test('rankedSearch: pure description match (no keyword overlap)', () => {
  // "Sortable" appears in the ULID description ("sortable Universally…") but
  // also as a keyword. Use a phrase unique to a description.
  const results = rankedSearch('Precision stopwatch');
  const chrono = results.find((r) => r.tool.slug === 'chronometer');
  assert.ok(chrono, 'chronometer should match "Precision stopwatch" via description');
  assert.ok(chrono.matchedFields.includes('description'));
});

test('rankedSearch: results sorted by descending score', () => {
  const results = rankedSearch('json');
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score,
      `result ${i - 1} score ${results[i - 1].score} < result ${i} score ${results[i].score}`);
  }
});

test('rankedSearch: stable order for equal scores (declaration order)', () => {
  // "crypto" matches all crypto tools with the same category-only score.
  const results = rankedSearch('crypto');
  // The first crypto tool in the registry is token-generator.
  assert.equal(results[0].tool.slug, 'token-generator');
});

/* ---- Recent searches ---- */
// Use a fresh storage key isolation: clear before each group.
test('recent: clear starts empty', () => {
  clearRecentSearches();
  assert.deepEqual(loadRecentSearches(), []);
});

test('recent: save adds entry', () => {
  clearRecentSearches();
  const after = saveRecentSearch('hash text');
  assert.equal(after.length, 1);
  assert.equal(after[0].query, 'hash text');
  assert.ok(after[0].timestamp > 0);
  assert.deepEqual(loadRecentSearches(), after);
});

test('recent: save bumps existing entry to front', () => {
  clearRecentSearches();
  saveRecentSearch('alpha');
  saveRecentSearch('beta');
  const after = saveRecentSearch('alpha');
  assert.equal(after.length, 2);
  assert.equal(after[0].query, 'alpha');
  assert.equal(after[1].query, 'beta');
});

test('recent: save is case-insensitive dedupe', () => {
  clearRecentSearches();
  saveRecentSearch('Hash');
  const after = saveRecentSearch('HASH');
  assert.equal(after.length, 1);
  assert.equal(after[0].query, 'HASH'); // newest query string wins
});

test('recent: save ignores empty/whitespace', () => {
  clearRecentSearches();
  saveRecentSearch('   ');
  assert.deepEqual(loadRecentSearches(), []);
  saveRecentSearch('');
  assert.deepEqual(loadRecentSearches(), []);
});

test('recent: capped at RECENT_MAX', () => {
  clearRecentSearches();
  for (let i = 0; i < RECENT_MAX + 5; i++) {
    saveRecentSearch(`query-${i}`);
  }
  const loaded = loadRecentSearches();
  assert.equal(loaded.length, RECENT_MAX);
  // Most recent first.
  assert.equal(loaded[0].query, `query-${RECENT_MAX + 4}`);
});

test('recent: remove deletes single entry', () => {
  clearRecentSearches();
  saveRecentSearch('alpha');
  saveRecentSearch('beta');
  const after = removeRecentSearch('alpha');
  assert.equal(after.length, 1);
  assert.equal(after[0].query, 'beta');
});

test('recent: remove is case-insensitive', () => {
  clearRecentSearches();
  saveRecentSearch('Alpha');
  const after = removeRecentSearch('ALPHA');
  assert.equal(after.length, 0);
});

test('recent: clear empties list', () => {
  saveRecentSearch('x');
  saveRecentSearch('y');
  const after = clearRecentSearches();
  assert.equal(after.length, 0);
  assert.deepEqual(loadRecentSearches(), []);
});

/* ---- Suggestions ---- */
test('suggestions: returns curated list of known tools', () => {
  const sugg = getSuggestedTools();
  assert.ok(sugg.length >= 6, `expected >= 6 suggestions, got ${sugg.length}`);
  for (const s of sugg) {
    assert.ok(s.tool.slug.length > 0);
    assert.ok(s.categoryLabel.length > 0);
    assert.equal(s.score, 0);
  }
  const slugs = sugg.map((s) => s.tool.slug);
  assert.ok(slugs.includes('uuid-generator'));
  assert.ok(slugs.includes('qr-code-generator'));
});

/* ---- Summary ---- */
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
