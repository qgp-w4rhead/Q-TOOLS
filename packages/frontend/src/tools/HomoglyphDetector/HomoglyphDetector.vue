<script setup lang="ts">
/**
 * HomoglyphDetector - flag confusable Unicode, punycode, and mixed-script
 * phishing indicators in a URL or domain.
 *
 * Decodes `xn--` labels via a built-in RFC 3492 punycode decoder, classifies
 * each character's script (Latin/Cyrillic/Greek), flags known confusable
 * lookalikes, and warns about `@` userinfo tricks, deep subdomains, and IP
 * literals.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ input | url |
 * domain }`; sends `output` PostMessages with `{ host, decodedHost,
 * hasPunycode, mixedScript, flagged, issues }`.
 */
import { useI18n } from 'vue-i18n';
import { AlertTriangle, CheckCircle2, Eraser, Info, ScanLine, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useHomoglyphDetector, type HomoglyphIssue } from './useHomoglyphDetector';

const { t } = useI18n();
const U = 'tools.homoglyph-detector.ui.';

const { input, result, clear } = useHomoglyphDetector();

function issueIcon(level: HomoglyphIssue['level']) {
  if (level === 'error') return XCircle;
  if (level === 'warning') return AlertTriangle;
  return Info;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton v-if="input" @click="clear">
          <Eraser :size="13" /> {{ t('common.clear') }}
        </ToolButton>
      </template>
      <ToolField
        v-model="input"
        mono
        placeholder="https://еxample.com or xn--xample-9ef.com"
        spellcheck="false"
        autocomplete="off"
        autocapitalize="off"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="result ? t(U + 'descHost', { host: result.host }) : t(U + 'descEmpty')"
      hide-copy
    >
      <template v-if="!result">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div class="hd__host-row">
            <span class="qt-stat-head">{{ t(U + 'rowHost') }}</span>
            <code class="qt-mono" style="font-size:13px;word-break:break-all;min-width:0">{{ result.host }}</code>
            <CopyButton :text="result.host" :label="t('common.copy')" icon-only />
          </div>
          <div v-if="result.decodedHost !== result.host" class="hd__host-row">
            <span class="qt-stat-head">{{ t(U + 'rowDecoded') }}</span>
            <code class="qt-mono" style="font-size:13px;word-break:break-all;min-width:0;color:var(--qt-warning);font-weight:600">{{ result.decodedHost }}</code>
            <CopyButton :text="result.decodedHost" :label="t('common.copy')" icon-only />
          </div>
        </div>

        <div class="qt-row" style="--qt-row-gap:6px">
          <span v-if="result.hasPunycode" class="qt-badge qt-badge--warn">punycode</span>
          <span v-if="result.hasNonAscii" class="qt-badge qt-badge--warn">non-ASCII</span>
          <span v-if="result.mixedScript" class="qt-badge qt-badge--error">mixed-script</span>
          <span v-for="s in result.scripts" :key="s" class="qt-badge">{{ s }}</span>
        </div>

        <ul class="qt-stack" style="--qt-stack-gap:5px;list-style:none;margin:0;padding:0">
          <li v-for="(iss, i) in result.issues" :key="i" class="hd__issue" :class="`hd__issue--${iss.level}`">
            <component :is="issueIcon(iss.level)" :size="13" />
            <span>{{ iss.message }}</span>
          </li>
        </ul>

        <div v-if="result.flagged.length">
          <p class="qt-stat-head" style="margin:0 0 8px"><ScanLine :size="13" /> {{ t(U + 'confTitle') }}</p>
          <div class="hd__flag-grid">
            <div v-for="(f, i) in result.flagged" :key="i" class="hd__flag">
              <span style="font-size:22px;font-weight:700;color:var(--qt-warning)">{{ f.char }}</span>
              <span class="qt-hint" style="font-size:11px;font-variant-numeric:tabular-nums">{{ f.codePoint }} · {{ f.script }}</span>
              <span v-if="f.resembles" style="font-size:11.5px;color:var(--qt-text)">{{ t(U + 'looksLike', { r: f.resembles }) }}</span>
            </div>
          </div>
        </div>

        <div v-if="!result.hasPunycode && !result.hasNonAscii && !result.mixedScript" class="qt-banner qt-banner--success">
          <CheckCircle2 :size="15" />
          <span>{{ t(U + 'bannerClean') }}</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Host row — fixed 72px label column + flexible code + copy. */
.hd__host-row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}

/* Issue line — colored by level. */
.hd__issue {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 12.5px;
  padding: 6px 9px;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
}
.hd__issue--error { color: var(--qt-danger); }
.hd__issue--warning { color: var(--qt-warning); }
.hd__issue--info { color: var(--qt-muted); }

/* Confusable-char grid — auto-fill cards. */
.hd__flag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.hd__flag {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
}
</style>
