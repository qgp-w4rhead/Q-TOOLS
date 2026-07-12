<script setup lang="ts">
/**
 * UuidGenerator — generate UUIDs of versions 1, 3, 4 and 5 (RFC 4122).
 *
 *   - v1: timestamp + clock sequence + random node (multicast bit set).
 *   - v3: MD5(namespace + name) — pure-JS MD5 (no external dep).
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

/** All UUIDs joined by newlines — used for the "copy all" button. */
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

const VERSION_OPTIONS: { value: UuidVersion; label: string; hint: string }[] = [
  { value: 'v4', label: 'v4', hint: 'random' },
  { value: 'v1', label: 'v1', hint: 'timestamp' },
  { value: 'v3', label: 'v3', hint: 'MD5 namespace' },
  { value: 'v5', label: 'v5', hint: 'SHA-1 namespace' },
];

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
  <div class="uuid-gen">
    <ToolInput
      title="Configuration"
      description="RFC 4122 UUIDs — v4 uses crypto.randomUUID(), v1/v3/v5 are custom-implemented."
    >
      <template #actions>
        <button
          class="uuid-gen__generate"
          type="button"
          :disabled="!canGenerate"
          @click="generate"
        >
          <Loader2 v-if="generating" :size="14" class="uuid-gen__spin" />
          <RefreshCw v-else :size="14" />
          <span>{{ generating ? 'Generating…' : 'Generate' }}</span>
        </button>
      </template>

      <div class="uuid-gen__field">
        <span class="uuid-gen__label">Version</span>
        <div class="uuid-gen__versions" role="radiogroup" aria-label="UUID version">
          <button
            v-for="opt in VERSION_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="version === opt.value"
            class="uuid-gen__version"
            :class="{ 'uuid-gen__version--active': version === opt.value }"
            :title="opt.hint"
            @click="version = opt.value"
          >
            <span class="uuid-gen__version-label">{{ opt.label }}</span>
            <span class="uuid-gen__version-hint">{{ opt.hint }}</span>
          </button>
        </div>
      </div>

      <label class="uuid-gen__field">
        <span class="uuid-gen__label">Quantity</span>
        <input
          class="uuid-gen__input"
          type="number"
          :min="MIN_QUANTITY"
          :max="MAX_QUANTITY"
          :value="quantity"
          @input="onQuantityInput"
        />
      </label>

      <div class="uuid-gen__toggles">
        <label class="uuid-gen__toggle">
          <input type="checkbox" :checked="hyphenated" @change="hyphenated = ($event.target as HTMLInputElement).checked" />
          <span>Hyphenated</span>
        </label>
        <label class="uuid-gen__toggle">
          <input type="checkbox" :checked="uppercase" @change="uppercase = ($event.target as HTMLInputElement).checked" />
          <span>Uppercase</span>
        </label>
      </div>

      <div v-if="needsNamespace" class="uuid-gen__ns">
        <div class="uuid-gen__field">
          <span class="uuid-gen__label">Namespace</span>
          <div class="uuid-gen__presets">
            <button
              v-for="p in NAMESPACE_PRESETS"
              :key="p.id"
              type="button"
              class="uuid-gen__preset"
              :class="{ 'uuid-gen__preset--active': namespacePreset === p.id }"
              @click="selectPreset(p)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <label v-if="namespacePreset === 'custom'" class="uuid-gen__field">
          <span class="uuid-gen__label">Custom namespace UUID</span>
          <input
            class="uuid-gen__input uuid-gen__input--mono"
            type="text"
            placeholder="e.g. 6ba7b810-9dad-11d1-80b4-00c04fd430c8"
            :value="customNamespace"
            :class="{ 'uuid-gen__input--err': !customNamespaceValid }"
            spellcheck="false"
            autocomplete="off"
            @input="onCustomNamespaceInput"
          />
          <span v-if="!customNamespaceValid" class="uuid-gen__hint uuid-gen__hint--err">
            Enter a valid canonical UUID.
          </span>
        </label>

        <label class="uuid-gen__field">
          <span class="uuid-gen__label">Name</span>
          <input
            class="uuid-gen__input uuid-gen__input--mono"
            type="text"
            placeholder="e.g. example.com (for DNS namespace)"
            :value="name"
            spellcheck="false"
            autocomplete="off"
            @input="onNameInput"
          />
        </label>

        <p v-if="namespacePreset !== 'custom'" class="uuid-gen__ns-preview">
          <span class="uuid-gen__ns-label">Effective namespace</span>
          <code class="uuid-gen__ns-value">{{ namespace }}</code>
        </p>
      </div>
    </ToolInput>

    <ToolOutput
      title="Generated UUIDs"
      :description="uuids.length ? `${uuids.length} UUID${uuids.length === 1 ? '' : 's'} (${version})` : ''"
      :copy-text="allUuidsText"
      copy-label="Copy all"
    >
      <p v-if="error" class="uuid-gen__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="uuids.length === 0" class="uuid-gen__empty">
        No UUIDs yet — click <strong>Generate</strong>.
      </p>
      <ul v-else class="uuid-gen__list">
        <li v-for="(u, i) in uuids" :key="i" class="uuid-gen__uuid">
          <span class="uuid-gen__idx">{{ i + 1 }}</span>
          <code class="uuid-gen__uuid-text">{{ u }}</code>
          <CopyButton :text="u" label="Copy" icon-only />
        </li>
      </ul>
    </ToolOutput>
  </div>
</template>

<style scoped>
.uuid-gen {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.uuid-gen__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.uuid-gen__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.uuid-gen__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 11px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.uuid-gen__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.uuid-gen__input--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
}
.uuid-gen__input--err {
  border-color: var(--qt-danger);
}
.uuid-gen__hint {
  font-size: 11.5px;
  color: var(--qt-muted);
}
.uuid-gen__hint--err {
  color: var(--qt-danger);
}
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
  will-change: border-color;
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
.uuid-gen__toggles {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}
.uuid-gen__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--qt-text);
  cursor: pointer;
}
.uuid-gen__toggle input[type='checkbox'] {
  accent-color: var(--qt-accent);
  cursor: pointer;
}
.uuid-gen__ns {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-surface) 98% c h / 0.4);
}
.uuid-gen__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.uuid-gen__preset {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-muted);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 10px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
  will-change: border-color;
}
.uuid-gen__preset:hover {
  border-color: var(--qt-accent);
  color: var(--qt-text);
}
.uuid-gen__preset--active {
  border-color: var(--qt-accent);
  background: var(--qt-accent);
  color: var(--qt-bg);
}
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 3px 7px;
  color: var(--qt-text);
  word-break: break-all;
}
.uuid-gen__generate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.uuid-gen__generate:hover:not(:disabled) {
  transform: translateY(-1px);
}
.uuid-gen__generate:active:not(:disabled) {
  transform: translateY(0);
}
.uuid-gen__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.uuid-gen__spin {
  animation: uuid-gen-spin 0.8s linear infinite;
}
@keyframes uuid-gen-spin {
  to {
    transform: rotate(360deg);
  }
}
.uuid-gen__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.uuid-gen__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.uuid-gen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 60vh;
  overflow-y: auto;
}
.uuid-gen__uuid {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 7px 10px;
}
.uuid-gen__idx {
  flex: 0 0 auto;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--qt-muted);
  min-width: 28px;
  text-align: right;
}
.uuid-gen__uuid-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
