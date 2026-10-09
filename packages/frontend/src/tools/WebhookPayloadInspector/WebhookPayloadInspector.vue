<script setup lang="ts">
/**
 * WebhookPayloadInspector — paste JSON, inspect as tree, filter with jq-style paths.
 */
import { RotateCcw, Search, ChevronRight, ChevronDown } from 'lucide-vue-next';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useWebhookPayloadInspector } from './useWebhookPayloadInspector';

const { input, filter, result, reset } = useWebhookPayloadInspector();

const { t } = useI18n();
const U = 'tools.webhook-payload-inspector.ui.';

const expandedPaths = ref<Set<string>>(new Set());

function toggle(path: string): void {
  if (expandedPaths.value.has(path)) {
    expandedPaths.value.delete(path);
  } else {
    expandedPaths.value.add(path);
  }
}

function isExpanded(path: string): boolean {
  return expandedPaths.value.has(path);
}

function typeColor(type: string): string {
  switch (type) {
    case 'string': return 'oklch(0.6 0.2 230)';
    case 'number': return 'oklch(0.7 0.2 145)';
    case 'boolean': return 'oklch(0.7 0.2 85)';
    case 'null': return 'var(--qt-muted)';
    default: return 'var(--qt-text)';
  }
}

const SAMPLE = `{
  "event": "user.created",
  "data": {
    "id": 12345,
    "email": "user@example.com",
    "active": true,
    "metadata": {
      "source": "api",
      "tags": ["new", "trial"]
    }
  },
  "timestamp": 1697123456789
}`;
</script>

<template>
  <div class="qt-tool">
    <ToolInput :title="t(U + 'inputTitle')" :description="t(U + 'desc')">
      <template #actions>
        <ToolButton @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
      </template>

      <ToolButton @click="input = SAMPLE">{{ t(U + 'loadSample') }}</ToolButton>

      <ToolField
        v-model="input"
        :label="t(U + 'jsonPayload')"
        as="textarea"
        mono
        :placeholder="t(U + 'phPayload')"
        spellcheck="false"
        :rows="8"
      />
    </ToolInput>

    <ToolOutput :title="t(U + 'outTitle')" :hide-copy="true">
      <template v-if="input.trim()">
        <ToolAlert v-if="!result.valid" kind="error">{{ result.error }}</ToolAlert>
        <template v-else>
          <div class="qt-row" style="--qt-row-gap:8px">
            <span class="qt-badge" style="font-size:12px">{{ t(U + 'keysBadge', { n: result.keyCount }) }}</span>
            <span class="qt-badge" style="font-size:12px">{{ t(U + 'bytesBadge', { n: result.sizeBytes }) }}</span>
          </div>

          <label class="wpi__filter">
            <Search :size="14" class="wpi__filter-icon" />
            <input class="wpi__filter-input" v-model="filter" :placeholder="t(U + 'phFilter')" spellcheck="false" />
          </label>

          <!-- Filtered results -->
          <div v-if="filter.trim() && result.filtered.length > 0" class="qt-stack" style="--qt-stack-gap:4px;max-height:300px;overflow-y:auto">
            <div v-for="(item, i) in result.filtered" :key="i" class="qt-panel qt-row qt-mono" style="--qt-row-gap:8px;flex-wrap:nowrap;font-size:13px;padding:4px 8px">
              <span style="color:var(--qt-muted);flex-shrink:0">{{ item.path }}</span>
              <span style="font-weight:600" :style="{ color: typeColor(item.type) }">{{ item.value }}</span>
            </div>
          </div>
          <ToolAlert v-else-if="filter.trim()" kind="empty">{{ t(U + 'noMatches', { filter }) }}</ToolAlert>

          <!-- Tree view -->
          <div v-else class="qt-stack qt-mono" style="--qt-stack-gap:2px;font-size:13px">
            <template v-for="node in result.tree" :key="node.path">
              <div class="wpi__node qt-row qt-row--center" style="--qt-row-gap:4px;flex-wrap:nowrap;padding:2px 4px;border-radius:2px">
                <button
                  v-if="node.children.length > 0"
                  type="button"
                  style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;color:var(--qt-muted)"
                  @click="toggle(node.path)"
                >
                  <component :is="isExpanded(node.path) ? ChevronDown : ChevronRight" :size="12" />
                </button>
                <span v-else style="width:12px;flex-shrink:0" />
                <span style="font-weight:600;color:var(--qt-text)">{{ node.key }}</span>
                <span v-if="node.type !== 'object' && node.type !== 'array'" :style="{ color: typeColor(node.type) }">: {{ String(node.value) }}</span>
                <span class="qt-hint" style="font-size:11px;margin-left:4px">{{ node.type }}</span>
              </div>
              <template v-if="isExpanded(node.path)">
                <div
                  v-for="child in node.children"
                  :key="child.path"
                  class="wpi__node qt-row qt-row--center"
                  style="--qt-row-gap:4px;flex-wrap:nowrap;padding:2px 4px;border-radius:2px;padding-left:20px"
                >
                  <button
                    v-if="child.children.length > 0"
                    type="button"
                    style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;color:var(--qt-muted)"
                    @click="toggle(child.path)"
                  >
                    <component :is="isExpanded(child.path) ? ChevronDown : ChevronRight" :size="12" />
                  </button>
                  <span v-else style="width:12px;flex-shrink:0" />
                  <span style="font-weight:600;color:var(--qt-text)">{{ child.key }}</span>
                  <span v-if="child.type !== 'object' && child.type !== 'array'" :style="{ color: typeColor(child.type) }">: {{ String(child.value) }}</span>
                  <span class="qt-hint" style="font-size:11px;margin-left:4px">{{ child.type }}</span>
                  <template v-if="isExpanded(child.path)">
                    <div
                      v-for="grandchild in child.children"
                      :key="grandchild.path"
                      class="wpi__node qt-row qt-row--center"
                      style="--qt-row-gap:4px;flex-wrap:nowrap;padding:2px 4px;border-radius:2px;padding-left:40px"
                    >
                      <button
                        v-if="grandchild.children.length > 0"
                        type="button"
                        style="background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;color:var(--qt-muted)"
                        @click="toggle(grandchild.path)"
                      >
                        <component :is="isExpanded(grandchild.path) ? ChevronDown : ChevronRight" :size="12" />
                      </button>
                      <span v-else style="width:12px;flex-shrink:0" />
                      <span style="font-weight:600;color:var(--qt-text)">{{ grandchild.key }}</span>
                      <span v-if="grandchild.type !== 'object' && grandchild.type !== 'array'" :style="{ color: typeColor(grandchild.type) }">: {{ String(grandchild.value) }}</span>
                      <span class="qt-hint" style="font-size:11px;margin-left:4px">{{ grandchild.type }}</span>
                    </div>
                  </template>
                </div>
              </template>
            </template>
          </div>
        </template>
      </template>
      <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Filter search box with leading icon. */
.wpi__filter { display: flex; align-items: center; gap: 6px; border: 1px solid var(--qt-border); border-radius: var(--qt-radius-sm); padding: 6px 10px; background: var(--qt-bg); }
.wpi__filter-icon { color: var(--qt-muted); flex-shrink: 0; }
.wpi__filter-input { flex: 1; border: none; background: transparent; color: var(--qt-text); font: inherit; font-size: 13px; font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; }
.wpi__filter-input:focus { outline: none; }

/* Tree node hover. */
.wpi__node:hover { background: var(--qt-bg); }
</style>
