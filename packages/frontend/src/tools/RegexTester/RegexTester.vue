<script setup lang="ts">
/**
 * RegexTester - test a regular expression against a string in real time.
 *
 * Inputs: pattern, flags (g/i/m/s/u/y chips), and a test string. The tool
 * compiles the pattern with the chosen flags, runs it against the test string,
 * and reports:
 *   - the test string with matches highlighted inline (rendered as text
 *     segments - no v-html of arbitrary user content)
 *   - a per-match list with the matched text, position, and capture groups
 *     (named + numbered)
 *   - the total match count
 *   - any compilation error
 *
 * A collapsible "Regex reference" sidebar lists the common tokens (character
 * classes, anchors, quantifiers, groups, lookaround, escapes) with examples.
 *
 * No external dependencies - only the built-in `RegExp`.
 *
 * Works in embed mode: receives `pattern` / `flags` / `testString` (or
 * `input`/`value`/`text` as a fallback for the test string) PostMessages to
 * pre-fill the fields; sends `output` PostMessages with
 * `{ pattern, flags, count, error, matches }` whenever the result changes.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.regex-tester.ui.';

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
  // Insert the token at the end of the pattern (simple UX - the user can edit
  // afterwards). Backslashes in the token are preserved verbatim.
  pattern.value = pattern.value + token;
}
</script>

<template>
  <div class="qt-tool">
    <div class="rt__main">
      <div class="qt-stack" style="min-width:0">
        <ToolInput
          :title="t(U + 'inputTitle')"
          :description="t(U + 'desc')"
        >
          <div class="qt-input-wrap">
            <Regex :size="16" class="rt__pattern-icon" />
            <input
              class="qt-input"
              style="font-family:var(--qt-font-mono);padding:10px 12px 10px 36px"
              type="text"
              :placeholder="t(U + 'phPattern')"
              :value="pattern"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="off"
              @input="onPattern"
            />
          </div>

          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;margin-top:10px">
            <span class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em;margin-right:2px">{{ t(U + 'flags') }}</span>
            <button
              v-for="f in REGEX_FLAGS"
              :key="f.char"
              type="button"
              class="qt-chip qt-chip--filled"
              :class="{ 'qt-chip--active': flags.includes(f.char) }"
              :title="`${f.char} - ${f.label}: ${f.description}`"
              @click="toggleFlag(f.char)"
            >
              <span class="qt-mono" style="font-weight:700">{{ f.char }}</span>
              <span>{{ f.label }}</span>
            </button>
            <input
              class="qt-input"
              style="width:70px;margin-left:auto;font-family:var(--qt-font-mono);font-size:12px;padding:4px 8px"
              type="text"
              :value="flags"
              spellcheck="false"
              autocomplete="off"
              :title="t(U + 'flagsTitle')"
              @input="onFlags"
            />
          </div>

          <div v-if="hasError" class="qt-banner qt-banner--error" style="margin-top:10px">
            <AlertTriangle :size="13" />
            <span>{{ compiled.error }}</span>
          </div>
        </ToolInput>

        <ToolInput
          :title="t(U + 'testTitle')"
          :description="t(U + 'testDesc')"
        >
          <textarea
            class="qt-input qt-input--mono"
            style="min-height:120px"
            :placeholder="t(U + 'phTest')"
            :value="testString"
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            rows="6"
            @input="onTest"
          ></textarea>
        </ToolInput>

        <ToolOutput
          :title="t(U + 'outTitle')"
          :description="
            hasPattern && hasTest
              ? t(matches.length === 1 ? U + 'descMatchesOne' : U + 'descMatches', { n: matches.length })
              : t(U + 'descEmpty')
          "
          :copy-text="hasMatches ? copyHighlightedHtml() : ''"
          :copy-label="t(U + 'copyHtml')"
        >
          <template v-if="!hasPattern || !hasTest">
            <p class="qt-alert qt-alert--empty">
              {{
                !hasPattern
                  ? t(U + 'needPattern')
                  : t(U + 'needTest')
              }}
            </p>
          </template>
          <template v-else-if="hasError">
            <p class="qt-alert qt-alert--empty">{{ t(U + 'fixError') }}</p>
          </template>
          <template v-else>
            <div class="qt-output" style="line-height:1.55;max-height:360px;white-space:pre-wrap;word-break:break-word">
              <template v-for="seg in segments" :key="`${seg.matchIndex}-${seg.text.length}`">
                <mark v-if="seg.isMatch" class="rt__mark">{{ seg.text }}</mark>
                <span v-else style="color:var(--qt-text)">{{ seg.text }}</span>
              </template>
              <span v-if="segments.length === 0" style="color:var(--qt-text)">{{ testString }}</span>
            </div>

            <div class="qt-row qt-row--center" style="--qt-row-gap:10px;margin-top:10px">
              <span class="qt-badge qt-badge--info" style="text-transform:uppercase">
                <Hash :size="12" />
                <span>{{ t(matches.length === 1 ? U + 'matchesBadgeOne' : U + 'matchesBadge', { n: matches.length }) }}</span>
              </span>
              <span v-if="matches.length === 0 && !hasError" style="color:var(--qt-muted);font-size:13px;font-style:italic">
                {{ t(U + 'noMatches') }}
              </span>
            </div>
          </template>
        </ToolOutput>

        <ToolOutput
          v-if="hasMatches"
          :title="t(U + 'listTitle')"
          :description="t(matches.length === 1 ? U + 'listDescOne' : U + 'listDesc', { n: matches.length })"
          :copy-text="copyMatchesJson()"
          :copy-label="t(U + 'copyJson')"
        >
          <div class="qt-stack" style="--qt-stack-gap:8px;max-height:480px;overflow:auto">
            <div v-for="m in matches" :key="m.matchIndex" class="qt-result" style="padding:10px 12px">
              <div class="qt-row qt-row--center" style="--qt-row-gap:10px">
                <span class="qt-badge qt-badge--info" style="padding:2px 8px">#{{ m.matchIndex + 1 }}</span>
                <code class="qt-value" style="background:oklch(from var(--qt-warning) 75% c h / 0.3);border-radius:3px;padding:1px 5px;word-break:break-all">{{ m.full || t(U + 'empty') }}</code>
                <span class="qt-value qt-value--sm" style="color:var(--qt-muted);margin-left:auto">[{{ m.start }}:{{ m.end }}]</span>
              </div>
              <div v-if="m.groups.length > 0" class="qt-grid" style="--qt-grid-min:180px;--qt-grid-gap:6px;margin-top:8px">
                <div
                  v-for="g in m.groups"
                  :key="g.index"
                  class="qt-result-row"
                  style="padding:4px 8px;min-width:0"
                >
                  <span class="qt-value qt-value--sm" style="font-weight:700;color:var(--qt-accent);flex-shrink:0">
                    <template v-if="g.name">{{ g.name }}</template>
                    <template v-else>${{ g.index }}</template>
                  </span>
                  <code class="qt-value qt-value--sm" style="word-break:break-all;min-width:0">{{ g.value === undefined ? t(U + 'notMatched') : (g.value || t(U + 'empty')) }}</code>
                </div>
              </div>
            </div>
          </div>
        </ToolOutput>
      </div>

      <aside class="rt__sidebar">
        <button
          type="button"
          class="qt-btn qt-btn--outline"
          style="font-size:12.5px;font-weight:700;padding:8px 10px;text-align:left"
          @click="showReference = !showReference"
        >
          <component :is="showReference ? ChevronDown : ChevronRight" :size="14" />
          <Search :size="13" />
          <span>{{ t(U + 'reference') }}</span>
        </button>
        <div v-show="showReference" class="qt-panel" style="padding:10px;overflow:auto;max-height:calc(100vh - 80px)">
          <section
            v-for="section in REGEX_REFERENCE"
            :key="section.title"
            style="margin-bottom:12px"
          >
            <h4 class="qt-stat-head" style="font-size:11px;letter-spacing:0.06em;margin:0 0 6px">{{ section.title }}</h4>
            <ul class="qt-list qt-stack" style="--qt-stack-gap:4px">
              <li
                v-for="entry in section.entries"
                :key="entry.token"
                class="rt__ref-entry"
              >
                <button
                  type="button"
                  class="qt-kbd rt__ref-token"
                  style="padding:2px 6px;color:var(--qt-accent);cursor:pointer;align-self:start"
                  :title="t(U + 'insertTitle', { token: entry.token })"
                  @click="insertToken(entry.token)"
                >
                  <code>{{ entry.token }}</code>
                </button>
                <span style="font-size:11.5px;color:var(--qt-text);line-height:1.35">{{ entry.description }}</span>
                <span class="qt-row qt-row--center" style="--qt-row-gap:4px;font-size:11px;color:var(--qt-muted)">
                  <code class="qt-mono" style="color:var(--qt-text)">{{ entry.example }}</code>
                  <span style="color:var(--qt-muted)">→</span>
                  <span style="font-style:italic">{{ entry.matches }}</span>
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Two-column layout — main column + sticky reference sidebar. */
.rt__main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: var(--qt-gap);
  align-items: start;
}

/* Leading icon inside .qt-input-wrap (the wrap only pads for a right button). */
.rt__pattern-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}

/* Inline match highlight inside the output. */
.rt__mark {
  background: oklch(from var(--qt-warning) 75% c h / 0.45);
  color: var(--qt-text);
  border-radius: 3px;
  padding: 1px 2px;
  font-weight: 600;
}

/* Sticky reference sidebar. */
.rt__sidebar {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 24px);
}

/* Reference entry — token column + desc/example rows. */
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
}
.rt__ref-token:hover {
  border-color: var(--qt-accent);
}
.rt__ref-token code {
  font-family: inherit;
}

@media (max-width: 880px) {
  .rt__main {
    grid-template-columns: 1fr;
  }
  .rt__sidebar {
    position: static;
    max-height: none;
  }
}
</style>
