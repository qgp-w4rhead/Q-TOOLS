<script setup lang="ts">
/**
 * RegexTester — test a regular expression against a string in real time.
 *
 * Inputs: pattern, flags (g/i/m/s/u/y chips), and a test string. The tool
 * compiles the pattern with the chosen flags, runs it against the test string,
 * and reports:
 *   - the test string with matches highlighted inline (rendered as text
 *     segments — no v-html of arbitrary user content)
 *   - a per-match list with the matched text, position, and capture groups
 *     (named + numbered)
 *   - the total match count
 *   - any compilation error
 *
 * A collapsible "Regex reference" sidebar lists the common tokens (character
 * classes, anchors, quantifiers, groups, lookaround, escapes) with examples.
 *
 * No external dependencies — only the built-in `RegExp`.
 *
 * Works in embed mode: receives `pattern` / `flags` / `testString` (or
 * `input`/`value`/`text` as a fallback for the test string) PostMessages to
 * pre-fill the fields; sends `output` PostMessages with
 * `{ pattern, flags, count, error, matches }` whenever the result changes.
 */
import { computed, ref } from 'vue';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Hash,
  Regex,
  Search,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  REGEX_FLAGS,
  REGEX_REFERENCE,
  useRegexTester,
} from './useRegexTester';

const {
  pattern,
  flags,
  testString,
  compiled,
  matches,
  segments,
  toggleFlag,
} = useRegexTester();

const showReference = ref<boolean>(true);

const hasPattern = computed(() => pattern.value.length > 0);
const hasTest = computed(() => testString.value.length > 0);
const hasError = computed(() => compiled.value.error !== null);
const hasMatches = computed(() => matches.value.length > 0);

function onPattern(e: Event): void {
  pattern.value = (e.target as HTMLInputElement).value;
}
function onTest(e: Event): void {
  testString.value = (e.target as HTMLTextAreaElement).value;
}
function onFlags(e: Event): void {
  flags.value = (e.target as HTMLInputElement).value;
}

function copyMatchesJson(): string {
  return JSON.stringify(
    matches.value.map((m) => ({
      match: m.matchIndex + 1,
      full: m.full,
      start: m.start,
      end: m.end,
      groups: m.groups.map((g) => ({
        index: g.index,
        name: g.name,
        value: g.value,
      })),
    })),
    null,
    2,
  );
}

function copyHighlightedHtml(): string {
  return segments.value
    .map((s) =>
      s.isMatch
        ? `<mark>${escapeForHtml(s.text)}</mark>`
        : escapeForHtml(s.text),
    )
    .join('');
}

function escapeForHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function insertToken(token: string): void {
  // Insert the token at the end of the pattern (simple UX — the user can edit
  // afterwards). Backslashes in the token are preserved verbatim.
  pattern.value = pattern.value + token;
}
</script>

<template>
  <div class="rt">
    <div class="rt__main">
      <div class="rt__col">
        <ToolInput
          title="Regular expression"
          description="Enter a pattern (without delimiters) and toggle flags. Matching is live as you type."
        >
          <div class="rt__pattern-row">
            <Regex :size="16" class="rt__pattern-icon" />
            <input
              class="rt__pattern-input"
              type="text"
              placeholder="\\b\\w+@\\w+\\.\\w+\\b"
              :value="pattern"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              @input="onPattern"
            />
          </div>

          <div class="rt__flags">
            <span class="rt__flags-label">Flags:</span>
            <button
              v-for="f in REGEX_FLAGS"
              :key="f.char"
              type="button"
              class="rt__flag"
              :class="{ 'rt__flag--on': flags.includes(f.char) }"
              :title="`${f.char} — ${f.label}: ${f.description}`"
              @click="toggleFlag(f.char)"
            >
              <span class="rt__flag-char">{{ f.char }}</span>
              <span class="rt__flag-label">{{ f.label }}</span>
            </button>
            <input
              class="rt__flags-raw"
              type="text"
              :value="flags"
              spellcheck="false"
              autocomplete="off"
              title="Type flags directly"
              @input="onFlags"
            />
          </div>

          <div v-if="hasError" class="rt__error">
            <AlertTriangle :size="13" />
            <span>{{ compiled.error }}</span>
          </div>
        </ToolInput>

        <ToolInput
          title="Test string"
          description="The text to match against. Matches are highlighted in the output below."
        >
          <textarea
            class="rt__test-input"
            placeholder="Paste the text to test against…"
            :value="testString"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            rows="6"
            @input="onTest"
          ></textarea>
        </ToolInput>

        <ToolOutput
          title="Highlighted matches"
          :description="
            hasPattern && hasTest
              ? `${matches.length} match${matches.length === 1 ? '' : 'es'}`
              : 'Enter a pattern and a test string to see matches.'
          "
          :copy-text="hasMatches ? copyHighlightedHtml() : ''"
          copy-label="Copy HTML"
        >
          <template v-if="!hasPattern || !hasTest">
            <p class="rt__empty">
              {{
                !hasPattern
                  ? 'Enter a regex pattern above.'
                  : 'Enter a test string to match against.'
              }}
            </p>
          </template>
          <template v-else-if="hasError">
            <p class="rt__empty">Fix the pattern error to see matches.</p>
          </template>
          <template v-else>
            <div class="rt__highlight">
              <template v-for="seg in segments" :key="`${seg.matchIndex}-${seg.text.length}`">
                <mark v-if="seg.isMatch" class="rt__mark">{{ seg.text }}</mark>
                <span v-else class="rt__plain">{{ seg.text }}</span>
              </template>
              <span v-if="segments.length === 0" class="rt__plain">{{ testString }}</span>
            </div>

            <div class="rt__count-row">
              <span class="rt__count-badge">
                <Hash :size="12" />
                <span>{{ matches.length }} match{{ matches.length === 1 ? '' : 'es' }}</span>
              </span>
              <span v-if="matches.length === 0 && !hasError" class="rt__no-match">
                No matches found.
              </span>
            </div>
          </template>
        </ToolOutput>

        <ToolOutput
          v-if="hasMatches"
          title="Match list"
          :description="`${matches.length} match${matches.length === 1 ? '' : 'es'} with capture groups`"
          :copy-text="copyMatchesJson()"
          copy-label="Copy JSON"
        >
          <div class="rt__match-list">
            <div v-for="m in matches" :key="m.matchIndex" class="rt__match">
              <div class="rt__match-head">
                <span class="rt__match-num">#{{ m.matchIndex + 1 }}</span>
                <code class="rt__match-full">{{ m.full || '(empty)' }}</code>
                <span class="rt__match-pos">[{{ m.start }}:{{ m.end }}]</span>
              </div>
              <div v-if="m.groups.length > 0" class="rt__groups">
                <div
                  v-for="g in m.groups"
                  :key="g.index"
                  class="rt__group"
                >
                  <span class="rt__group-key">
                    <template v-if="g.name">{{ g.name }}</template>
                    <template v-else>${{ g.index }}</template>
                  </span>
                  <code class="rt__group-val">{{ g.value === undefined ? '(not matched)' : (g.value || '(empty)') }}</code>
                </div>
              </div>
            </div>
          </div>
        </ToolOutput>
      </div>

      <aside class="rt__sidebar">
        <button
          type="button"
          class="rt__sidebar-toggle"
          @click="showReference = !showReference"
        >
          <component :is="showReference ? ChevronDown : ChevronRight" :size="14" />
          <Search :size="13" />
          <span>Regex reference</span>
        </button>
        <div v-show="showReference" class="rt__ref">
          <section
            v-for="section in REGEX_REFERENCE"
            :key="section.title"
            class="rt__ref-section"
          >
            <h4 class="rt__ref-title">{{ section.title }}</h4>
            <ul class="rt__ref-list">
              <li
                v-for="entry in section.entries"
                :key="entry.token"
                class="rt__ref-entry"
              >
                <button
                  type="button"
                  class="rt__ref-token"
                  :title="`Insert ${entry.token} into the pattern`"
                  @click="insertToken(entry.token)"
                >
                  <code>{{ entry.token }}</code>
                </button>
                <span class="rt__ref-desc">{{ entry.description }}</span>
                <span class="rt__ref-example">
                  <code>{{ entry.example }}</code>
                  <span class="rt__ref-arrow">→</span>
                  <span class="rt__ref-matches">{{ entry.matches }}</span>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.rt {
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.rt__main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--qt-gap);
  align-items: start;
}
.rt__col {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  min-width: 0;
}
.rt__pattern-row {
  position: relative;
  display: flex;
  align-items: center;
}
.rt__pattern-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.rt__pattern-input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 14px;
  padding: 10px 12px 10px 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.rt__pattern-input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.rt__flags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.rt__flags-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
  margin-right: 2px;
}
.rt__flag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-muted);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}
.rt__flag:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.rt__flag--on {
  background: oklch(from var(--qt-accent) 25% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.55);
  color: var(--qt-accent);
}
.rt__flag-char {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-weight: 700;
}
.rt__flags-raw {
  width: 70px;
  margin-left: auto;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 4px 8px;
}
.rt__flags-raw:focus {
  border-color: var(--qt-accent);
  outline: none;
}
.rt__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 10px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
}
.rt__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.rt__test-input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 120px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.rt__test-input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.rt__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.rt__highlight {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 12px;
  color: var(--qt-text);
  max-height: 360px;
  overflow: auto;
}
.rt__mark {
  background: oklch(from var(--qt-warning) 75% c h / 0.45);
  color: var(--qt-text);
  border-radius: 3px;
  padding: 1px 2px;
  font-weight: 600;
}
.rt__plain {
  color: var(--qt-text);
}
.rt__count-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.rt__count-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: oklch(from var(--qt-accent) 25% c h / 0.18);
  border: 1px solid oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rt__no-match {
  color: var(--qt-muted);
  font-size: 13px;
  font-style: italic;
}
.rt__match-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 480px;
  overflow: auto;
}
.rt__match {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px 12px;
}
.rt__match-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.rt__match-num {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 25% c h / 0.18);
  border-radius: 999px;
  padding: 2px 8px;
}
.rt__match-full {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13.5px;
  color: var(--qt-text);
  background: oklch(from var(--qt-warning) 75% c h / 0.3);
  border-radius: 3px;
  padding: 1px 5px;
  word-break: break-all;
}
.rt__match-pos {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: var(--qt-muted);
  margin-left: auto;
}
.rt__groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.rt__group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--qt-bg-elevated, var(--qt-bg));
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-width: 0;
}
.rt__group-key {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--qt-accent);
  flex-shrink: 0;
}
.rt__group-val {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--qt-text);
  word-break: break-all;
  min-width: 0;
}
/* Sidebar */
.rt__sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 24px);
}
.rt__sidebar-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
}
.rt__sidebar-toggle:hover {
  border-color: var(--qt-accent);
}
.rt__ref {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 10px;
  overflow: auto;
  max-height: calc(100vh - 80px);
}
.rt__ref-section {
  margin-bottom: 12px;
}
.rt__ref-section:last-child {
  margin-bottom: 0;
}
.rt__ref-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.rt__ref-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rt__ref-entry {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'token desc'
    'token example';
  gap: 2px 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--qt-border);
}
.rt__ref-entry:last-child {
  border-bottom: none;
}
.rt__ref-token {
  grid-area: token;
  background: transparent;
  border: 1px solid var(--qt-border);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  color: var(--qt-accent);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 11.5px;
  align-self: start;
  transition: border-color 0.15s ease;
}
.rt__ref-token:hover {
  border-color: var(--qt-accent);
}
.rt__ref-token code {
  font-family: inherit;
}
.rt__ref-desc {
  grid-area: desc;
  font-size: 11.5px;
  color: var(--qt-text);
  line-height: 1.35;
}
.rt__ref-example {
  grid-area: example;
  font-size: 11px;
  color: var(--qt-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.rt__ref-example code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  color: var(--qt-text);
}
.rt__ref-arrow {
  color: var(--qt-muted);
}
.rt__ref-matches {
  font-style: italic;
}
@media (max-width: 880px) {
  .rt__main {
    grid-template-columns: 1fr;
  }
  .rt__sidebar {
    position: static;
    max-height: none;
  }
  .rt__ref {
    max-height: 360px;
  }
}
</style>
