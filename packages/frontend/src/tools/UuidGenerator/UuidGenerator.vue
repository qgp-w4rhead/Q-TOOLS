<script setup lang="ts">
/**
 * UuidGenerator - generate UUIDs of versions 1, 3, 4 and 5 (RFC 4122).
 *
 *   - v1: timestamp + clock sequence + random node (multicast bit set).
 *   - v3: MD5(namespace + name) - pure-JS MD5 (no external dep).
 *   - v4: `crypto.randomUUID()` (cryptographically secure random).
 *   - v5: SHA-1(namespace + name) via Web Crypto.
 *
 * Configurable quantity (1-10000), uppercase option, hyphenated/non-hyphenated
 * option. Per-UUID copy + copy-all.
 *
 * Works in embed mode: receives `input` PostMessages to set version/quantity/
 * formatting/namespace/name and sends `output` PostMessages with the generated
 * UUIDs.
 */
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCw, AlertCircle, Loader2 } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useUuidGenerator,
  MIN_QUANTITY,
  MAX_QUANTITY,
  NAMESPACE_PRESETS,
  isValidUuid,
  type UuidVersion,
  type NamespacePreset,
} from './useUuidGenerator';

const { t } = useI18n();

const {
  version,
  quantity,
  uppercase,
  hyphenated,
  namespacePreset,
  customNamespace,
  namespace,
  name,
  uuids,
  generating,
  error,
  generate,
} = useUuidGenerator();

/** All UUIDs joined by newlines - used for the "copy all" button. */
const allUuidsText = computed(() => uuids.value.join('\n'));

/** Whether the current version requires a namespace + name (v3/v5). */
const needsNamespace = computed(() => version.value === 'v3' || version.value === 'v5');

/** Whether the custom namespace input looks like a valid UUID. */
const customNamespaceValid = computed(
  () => customNamespace.value.length === 0 || isValidUuid(customNamespace.value),
);

/** Whether the Generate button should be enabled. */
const canGenerate = computed(() => {
  if (generating.value) return false;
  if (needsNamespace.value) {
    if (namespacePreset.value === 'custom' && !isValidUuid(customNamespace.value)) return false;
    if (name.value.length === 0) return false;
  }
  return true;
});

const VERSION_OPTIONS: { value: UuidVersion; label: string; hintKey: string }[] = [
  { value: 'v4', label: 'v4', hintKey: 'v4Hint' },
  { value: 'v1', label: 'v1', hintKey: 'v1Hint' },
  { value: 'v3', label: 'v3', hintKey: 'v3Hint' },
  { value: 'v5', label: 'v5', hintKey: 'v5Hint' },
];

/** Localized label for a namespace preset (custom is translated; RFC names stay). */
function presetLabel(p: NamespacePreset): string {
  return p.id === 'custom' ? t('tools.uuid-generator.ui.nsCustom') : p.label;
}

function onQuantityInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(v)) {
    quantity.value = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Math.floor(v)));
  }
}

function onNameInput(e: Event): void {
  name.value = (e.target as HTMLInputElement).value;
}

function onCustomNamespaceInput(e: Event): void {
  customNamespace.value = (e.target as HTMLInputElement).value;
}

function selectPreset(p: NamespacePreset): void {
  namespacePreset.value = p.id;
}

// Generate an initial UUID on mount so the output area is never empty.
onMounted(() => {
  if (uuids.value.length === 0 && canGenerate.value) void generate();
});
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.configuration')"
      :description="t('tools.uuid-generator.ui.desc')"
    >
      <template #actions>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="qt-spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? t('common.generating') : t('common.generate') }}</span>
        </button>
      </template>

      <div class="qt-field">
        <span class="qt-label">{{ t('tools.uuid-generator.ui.version') }}</span>
        <div class="uuid-gen__versions" role="radiogroup" :aria-label="t('tools.uuid-generator.ui.versionLabel')">
          <button
            v-for="opt in VERSION_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="version === opt.value"
            class="uuid-gen__version"
            :class="{ 'uuid-gen__version--active': version === opt.value }"
            :title="t(`tools.uuid-generator.ui.${opt.hintKey}`)"
            @click="version = opt.value"
          >
            <span class="uuid-gen__version-label">{{ opt.label }}</span>
            <span class="uuid-gen__version-hint">{{ t(`tools.uuid-generator.ui.${opt.hintKey}`) }}</span>
          </button>
        </div>
      </div>

      <label class="qt-field">
        <span class="qt-label">{{ t('common.quantity') }}</span>
        <input
          class="qt-input"
          type="number"
          :min="MIN_QUANTITY"
          :max="MAX_QUANTITY"
          :value="quantity"
          @input="onQuantityInput"
        />
      </label>

      <div class="qt-row" style="--qt-row-gap:18px">
        <label class="qt-check">
          <input type="checkbox" :checked="hyphenated" @change="hyphenated = ($event.target as HTMLInputElement).checked" />
          <span>{{ t('common.hyphenated') }}</span>
        </label>
        <label class="qt-check">
          <input type="checkbox" :checked="uppercase" @change="uppercase = ($event.target as HTMLInputElement).checked" />
          <span>{{ t('common.uppercase') }}</span>
        </label>
      </div>

      <div v-if="needsNamespace" class="uuid-gen__ns">
        <div class="qt-field">
          <span class="qt-label">{{ t('tools.uuid-generator.ui.namespace') }}</span>
          <div class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="p in NAMESPACE_PRESETS"
              :key="p.id"
              type="button"
              class="qt-chip qt-chip--filled"
              :class="{ 'qt-chip--active': namespacePreset === p.id }"
              @click="selectPreset(p)"
            >
              {{ presetLabel(p) }}
            </button>
          </div>
        </div>

        <label v-if="namespacePreset === 'custom'" class="qt-field">
          <span class="qt-label">{{ t('tools.uuid-generator.ui.customNamespace') }}</span>
          <input
            class="qt-input qt-input--mono"
            type="text"
            :placeholder="t('tools.uuid-generator.ui.customNsPlaceholder')"
            :value="customNamespace"
            :class="{ 'qt-input--error': !customNamespaceValid }"
            spellcheck="false"
            autocomplete="off"
            @input="onCustomNamespaceInput"
          />
          <span v-if="!customNamespaceValid" class="qt-hint qt-hint--error">
            {{ t('tools.uuid-generator.ui.customNsInvalid') }}
          </span>
        </label>

        <label class="qt-field">
          <span class="qt-label">{{ t('common.name') }}</span>
          <input
            class="qt-input qt-input--mono"
            type="text"
            :placeholder="t('tools.uuid-generator.ui.namePlaceholder')"
            :value="name"
            spellcheck="false"
            autocomplete="off"
            @input="onNameInput"
          />
        </label>

        <p v-if="namespacePreset !== 'custom'" class="uuid-gen__ns-preview">
          <span class="uuid-gen__ns-label">{{ t('tools.uuid-generator.ui.effectiveNs') }}</span>
          <code class="qt-mono uuid-gen__ns-value">{{ namespace }}</code>
        </p>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t('tools.uuid-generator.ui.outputTitle')"
      :description="uuids.length ? t('tools.uuid-generator.ui.outputDesc', { n: uuids.length, version }, uuids.length) : ''"
      :copy-text="allUuidsText"
      :copy-label="t('common.copyAll')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="uuids.length === 0" class="qt-alert qt-alert--empty">
        {{ t('tools.uuid-generator.ui.empty') }}
      </p>
      <ul v-else class="qt-list qt-stack uuid-gen__list" style="--qt-stack-gap:6px">
        <li v-for="(u, i) in uuids" :key="i" class="qt-result-row">
          <span class="uuid-gen__idx">{{ i + 1 }}</span>
          <code class="qt-mono uuid-gen__uuid-text">{{ u }}</code>
          <CopyButton :text="u" :label="t('common.copy')" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Version picker — fixed 4-col grid of selectable cards. */
.uuid-gen__versions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.uuid-gen__version {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  padding: 8px 4px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.uuid-gen__version:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.uuid-gen__version--active {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.15);
  color: var(--qt-accent);
}
.uuid-gen__version-label {
  font-size: 14px;
  font-weight: 700;
}
.uuid-gen__version-hint {
  font-size: 10.5px;
  opacity: 0.85;
}
/* Namespace sub-panel. */
.uuid-gen__ns {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-surface) 98% c h / 0.4);
}
/* Effective-namespace preview line. */
.uuid-gen__ns-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 0;
  font-size: 12px;
  color: var(--qt-muted);
}
.uuid-gen__ns-label {
  font-weight: 600;
}
.uuid-gen__ns-value {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 3px 7px;
  color: var(--qt-text);
  word-break: break-all;
}
/* Scrollable UUID list. */
.uuid-gen__list {
  max-height: 60vh;
  overflow-y: auto;
}
/* Row index. */
.uuid-gen__idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 28px;
  text-align: right;
}
/* UUID text (font via .qt-mono). */
.uuid-gen__uuid-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
