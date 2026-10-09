<script setup lang="ts">
/**
 * XssPayloadSanitizer - test HTML input against XSS vectors with
 * allowlist-based filtering.
 */
import { useI18n } from 'vue-i18n';
import { RotateCcw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useXssPayloadSanitizer,
} from './useXssPayloadSanitizer';

const { t } = useI18n();
const U = 'tools.xss-payload-sanitizer.ui.';

const {
  inputHtml,
  options,
  result,
  reset,
} = useXssPayloadSanitizer();
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.reset')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolField
        v-model="inputHtml"
        :label="t(U + 'htmlLabel')"
        as="textarea"
        mono
        :rows="8"
        :placeholder="t(U + 'phHtml')"
      />

      <div class="qt-stack">
        <label class="qt-check">
          <input type="checkbox" v-model="options.stripScriptTags" />
          <span>{{ t(U + 'optStripTags') }}</span>
        </label>
        <label class="qt-check">
          <input type="checkbox" v-model="options.stripEventHandlers" />
          <span>{{ t(U + 'optStripHandlers') }}</span>
        </label>
        <label class="qt-check">
          <input type="checkbox" v-model="options.stripStyleAttributes" />
          <span>{{ t(U + 'optStripStyles') }}</span>
        </label>
        <label class="qt-check">
          <input type="checkbox" v-model="options.stripComments" />
          <span>{{ t(U + 'optStripComments') }}</span>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="t(U + 'outDesc')"
      :copy-text="result.sanitized"
    >
      <pre v-if="result.sanitized" class="qt-output" style="margin:0;max-height:400px">{{ result.sanitized }}</pre>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>

      <div class="qt-row qt-row--center" style="--qt-row-gap:12px;padding-top:10px;border-top:1px solid var(--qt-border);flex-wrap:nowrap">
        <span
          class="qt-badge"
          :class="result.isSafe ? 'qt-badge--success' : 'qt-badge--error'"
        >
          {{ result.isSafe ? t(U + 'badgeSafe') : t(U + 'badgeUnsafe') }}
        </span>
        <span class="qt-hint" style="font-size:12.5px">{{ t(result.removedCount === 1 ? U + 'removedCountOne' : U + 'removedCount', { n: result.removedCount }) }}</span>
      </div>

      <div v-if="result.findings.length > 0" class="qt-stack" style="--qt-stack-gap:4px;max-height:300px;overflow-y:auto">
        <div style="font-size:13px;font-weight:700;color:var(--qt-text);padding-bottom:4px">{{ t(U + 'findingsTitle', { n: result.findings.length }) }}</div>
        <div
          v-for="(f, i) in result.findings"
          :key="i"
          class="xss__finding"
          :class="`xss__finding--${f.severity}`"
        >
          <span class="xss__finding-severity">{{ f.severity.toUpperCase() }}</span>
          <span class="xss__finding-message">{{ f.message }}</span>
          <code v-if="f.context" class="xss__finding-context">{{ f.context }}</code>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Finding row — severity-tinted box. */
.xss__finding {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--qt-radius-sm);
  font-size: 12.5px;
}
.xss__finding--danger {
  background: oklch(from var(--qt-danger) 95% c h / 0.1);
  border: 1px solid oklch(from var(--qt-danger) 80% c h / 0.3);
}
.xss__finding--warning {
  background: oklch(from var(--qt-warning) 95% c h / 0.1);
  border: 1px solid oklch(from var(--qt-warning) 80% c h / 0.3);
}
.xss__finding--info {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
}
.xss__finding-severity {
  font-weight: 700;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--qt-surface);
}
.xss__finding-message {
  flex: 1;
  color: var(--qt-text);
}
.xss__finding-context {
  font-family: var(--qt-font-mono);
  font-size: 11px;
  color: var(--qt-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
