<script setup lang="ts">
/**
 * WcagReference - searchable WCAG 2.2 criteria database.
 *
 * Search and filter WCAG 2.2 success criteria by level (A/AA/AAA) and
 * keyword. Shows principle, guideline, and description for each criterion.
 */
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useWcagReference,
} from './useWcagReference';
import {
  WCAG_PRINCIPLES,
} from './wcagDatabase';

const { query, level, results, totalCount, levelCounts, levels } = useWcagReference();

const { t } = useI18n();
const U = 'tools.wcag-reference.ui.';

function principleTitle(id: string): string {
  const p = WCAG_PRINCIPLES.find(p => p.id === id);
  return p ? `${p.ref} ${p.title}` : id;
}

function levelClass(l: string): string {
  return `wcr__level--${l.toLowerCase()}`;
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-row" style="--qt-row-gap:12px">
        <ToolField
          v-model="query"
          :label="t(U + 'search')"
          :placeholder="t(U + 'placeholder')"
          grow
        />
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'level') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 12px" v-model="level">
            <option value="all">{{ t(U + 'allLevels', { n: totalCount }) }}</option>
            <option v-for="l in levels" :key="l" :value="l">{{ t(U + 'levelCount', { l, n: levelCounts[l] }) }}</option>
          </select>
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="t(U + 'descCount', { n: results.length })"
      :hide-copy="true"
    >
      <div v-if="results.length > 0" class="qt-stack" style="--qt-stack-gap:10px">
        <div v-for="c in results" :key="c.id" class="qt-panel" style="padding:14px">
          <div class="qt-row qt-row--center qt-row--between" style="margin-bottom:6px">
            <span class="qt-mono" style="font-weight:700;font-size:14px;color:var(--qt-accent)">{{ c.ref }}</span>
            <span class="qt-badge" :class="levelClass(c.level)">{{ c.level }}</span>
          </div>
          <h3 style="margin:0 0 4px;font-size:15px;font-weight:600;color:var(--qt-text)">{{ c.title }}</h3>
          <p class="qt-hint" style="margin:0 0 6px;font-size:12px;text-transform:capitalize">{{ principleTitle(c.principleId) }}</p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:var(--qt-text)">{{ c.description }}</p>
          <a
            :href="c.url"
            target="_blank"
            rel="noopener noreferrer"
            class="wcr__link"
          >
            {{ t(U + 'viewDoc') }}
          </a>
        </div>
      </div>
      <ToolAlert v-else kind="empty">{{ t(U + 'emptyAlert') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: per-level badge tints + link hover underline. */
.wcr__level--a {
  background: color-mix(in srgb, var(--qt-success) 20%, transparent);
  color: var(--qt-success);
}
.wcr__level--aa {
  background: color-mix(in srgb, var(--qt-accent) 20%, transparent);
  color: var(--qt-accent);
}
.wcr__level--aaa {
  background: color-mix(in srgb, var(--qt-warning) 20%, transparent);
  color: var(--qt-warning);
}
.wcr__link {
  font-size: 12.5px;
  color: var(--qt-accent);
  text-decoration: none;
}
.wcr__link:hover {
  text-decoration: underline;
}
</style>
