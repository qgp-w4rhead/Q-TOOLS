<script setup lang="ts">
/**
 * HttpMethodsReference — searchable reference for HTTP methods.
 */
import { useI18n } from 'vue-i18n';
import { Search, Shield, RefreshCw, Package, FileText } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useHttpMethodsReference } from './useHttpMethodsReference';

const { query, filtered } = useHttpMethodsReference();

const { t } = useI18n();
const U = 'tools.http-methods-reference.ui.';
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <label class="hmr__search">
        <Search :size="14" class="hmr__search-icon" />
        <input class="hmr__search-input" v-model="query" :placeholder="t(U + 'phSearch')" spellcheck="false" />
      </label>
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :hide-copy="true">
      <div class="qt-stack" style="--qt-stack-gap:8px">
        <div v-for="m in filtered" :key="m.method" class="qt-panel" style="padding:10px 14px">
          <div class="qt-row qt-row--center qt-row--between" style="margin-bottom:6px">
            <span class="hmr__method" :class="`hmr__method--${m.method.toLowerCase()}`">{{ m.method }}</span>
            <span class="qt-hint" style="font-size:11px">{{ m.rfc }}</span>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:var(--qt-text);line-height:1.4">{{ m.description }}</p>
          <div class="qt-row" style="--qt-row-gap:6px">
            <span class="qt-badge" :class="m.safe ? 'qt-badge--success' : ''" style="font-size:11px">
              <Shield :size="12" />
              {{ m.safe ? t(U + 'safe') : t(U + 'unsafe') }}
            </span>
            <span class="qt-badge" :class="m.idempotent ? 'qt-badge--success' : ''" style="font-size:11px">
              <RefreshCw :size="12" />
              {{ m.idempotent ? t(U + 'idempotent') : t(U + 'nonIdempotent') }}
            </span>
            <span class="qt-badge" :class="m.cacheable ? 'qt-badge--success' : ''" style="font-size:11px">
              <Package :size="12" />
              {{ m.cacheable ? t(U + 'cacheable') : t(U + 'notCacheable') }}
            </span>
            <span class="qt-badge" :class="m.hasBody ? 'qt-badge--success' : ''" style="font-size:11px">
              <FileText :size="12" />
              {{ m.hasBody ? t(U + 'hasBody') : t(U + 'noBody') }}
            </span>
          </div>
        </div>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Search box with leading icon. */
.hmr__search { display: flex; align-items: center; gap: 6px; border: 1px solid var(--qt-border); border-radius: var(--qt-radius-sm); padding: 6px 10px; background: var(--qt-bg); }
.hmr__search-icon { color: var(--qt-muted); flex-shrink: 0; }
.hmr__search-input { flex: 1; border: none; background: transparent; color: var(--qt-text); font: inherit; font-size: 13px; }
.hmr__search-input:focus { outline: none; }

/* Per-method tinted badges. */
.hmr__method { font-size: 14px; font-weight: 800; font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; padding: 2px 8px; border-radius: var(--qt-radius-sm); }
.hmr__method--get { background: oklch(0.6 0.2 145 / 0.1); color: oklch(0.6 0.2 145); }
.hmr__method--post { background: oklch(0.6 0.2 230 / 0.1); color: oklch(0.6 0.2 230); }
.hmr__method--put { background: oklch(0.7 0.2 85 / 0.1); color: oklch(0.7 0.2 85); }
.hmr__method--patch { background: oklch(0.7 0.2 60 / 0.1); color: oklch(0.7 0.2 60); }
.hmr__method--delete { background: oklch(0.6 0.2 25 / 0.1); color: oklch(0.6 0.2 25); }
.hmr__method--head, .hmr__method--options, .hmr__method--trace, .hmr__method--connect { background: var(--qt-surface); color: var(--qt-muted); }
</style>
