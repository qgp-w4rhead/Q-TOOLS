<script setup lang="ts">
/**
 * DateTimeConverter — convert between date-time formats and timezones.
 *
 * Inputs: ISO 8601, Unix seconds, Unix milliseconds, custom token format, or
 * auto-detect. Outputs: ISO 8601, Unix seconds, Unix ms, RFC 2822, custom
 * token format, relative time. Timezone selectable across all IANA zones.
 *
 * No external dependencies — uses only `Date` and the `Intl` API.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input and
 * settings, and sends `output` PostMessages whenever the computed outputs
 * change.
 */
import { computed } from 'vue';
import { AlertCircle, Clock, RefreshCw } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import {
  useDateTimeConverter,
  INPUT_FORMATS,
  type InputFormat,
} from './useDateTimeConverter';

const {
  input,
  format,
  customFormat,
  outputCustomFormat,
  timeZone,
  date,
  outputs,
  error,
  timezones,
  recompute,
  setFormat,
  setTimeZone,
  now,
} = useDateTimeConverter();

/** Whether the custom-format input should be shown (only in custom mode). */
const showCustomInput = computed(() => format.value === 'custom');

/** Output rows for the results grid. */
const outputRows = computed(() => {
  const o = outputs.value;
  if (!o) return [];
  return [
    { key: 'iso', label: 'ISO 8601', value: o.iso, hint: timeZone.value },
    { key: 'unixSeconds', label: 'Unix seconds', value: o.unixSeconds, hint: 's' },
    { key: 'unixMs', label: 'Unix milliseconds', value: o.unixMs, hint: 'ms' },
    { key: 'rfc2822', label: 'RFC 2822', value: o.rfc2822, hint: 'email' },
    { key: 'custom', label: 'Custom format', value: o.custom, hint: outputCustomFormat.value },
    { key: 'relative', label: 'Relative time', value: o.relative, hint: 'from now' },
  ];
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

function onFormatChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as InputFormat;
  setFormat(value);
}

function onTimeZoneChange(e: Event): void {
  setTimeZone((e.target as HTMLSelectElement).value);
}

function onCustomFormatInput(e: Event): void {
  customFormat.value = (e.target as HTMLInputElement).value;
}

function onOutputCustomFormatInput(e: Event): void {
  outputCustomFormat.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="dtc">
    <ToolInput
      title="Input"
      description="Enter a date-time. Auto-detect tries ISO, Unix, RFC 2822, then custom."
    >
      <template #actions>
        <button class="dtc__btn dtc__btn--ghost" type="button" title="Use current time" @click="now">
          <Clock :size="14" />
          <span>Now</span>
        </button>
        <button
          class="dtc__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <label class="dtc__field">
        <span class="dtc__label">Date-time input</span>
        <textarea
          class="dtc__textarea"
          rows="3"
          placeholder="e.g. 2024-01-15T10:30:00Z  ·  1705312200  ·  Mon, 15 Jan 2024 10:30:00 +0000"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>

      <div class="dtc__row">
        <label class="dtc__field dtc__field--grow">
          <span class="dtc__label">Input format</span>
          <select class="dtc__select" :value="format" @change="onFormatChange">
            <option v-for="f in INPUT_FORMATS" :key="f.id" :value="f.id">
              {{ f.label }} — {{ f.hint }}
            </option>
          </select>
        </label>

        <label class="dtc__field dtc__field--grow">
          <span class="dtc__label">Timezone</span>
          <select class="dtc__select" :value="timeZone" @change="onTimeZoneChange">
            <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </label>
      </div>

      <label v-if="showCustomInput" class="dtc__field">
        <span class="dtc__label">Input custom format (tokens: YYYY YY MM DD HH mm ss SSS Z)</span>
        <input
          class="dtc__input"
          type="text"
          placeholder="YYYY-MM-DDTHH:mm:ssZ"
          :value="customFormat"
          spellcheck="false"
          autocomplete="off"
          @input="onCustomFormatInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="Outputs"
      :description="date ? `Parsed: ${date.toISOString()}` : 'Enter a valid date-time above.'"
      :copy-text="outputs?.iso ?? ''"
      copy-label="Copy ISO"
    >
      <p v-if="error" class="dtc__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!outputs" class="dtc__empty">
        Enter a date-time above to see all format conversions.
      </p>
      <div v-else class="dtc__results">
        <div v-for="row in outputRows" :key="row.key" class="dtc__row-out">
          <div class="dtc__row-head">
            <span class="dtc__row-label">{{ row.label }}</span>
            <span class="dtc__row-hint">{{ row.hint }}</span>
            <CopyButton :text="row.value" label="Copy" icon-only />
          </div>
          <code class="dtc__code">{{ row.value || '—' }}</code>
        </div>
      </div>

      <label v-if="outputs" class="dtc__field dtc__field--custom-out">
        <span class="dtc__label">Output custom format (tokens: YYYY YY MM DD HH mm ss SSS Z)</span>
        <input
          class="dtc__input"
          type="text"
          placeholder="YYYY-MM-DD HH:mm:ss"
          :value="outputCustomFormat"
          spellcheck="false"
          autocomplete="off"
          @input="onOutputCustomFormatInput"
        />
      </label>
    </ToolOutput>
  </div>
</template>

<style scoped>
.dtc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.dtc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dtc__field--grow {
  flex: 1;
  min-width: 0;
}
.dtc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.dtc__textarea,
.dtc__input,
.dtc__select {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.dtc__textarea {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  resize: vertical;
  min-height: 72px;
}
.dtc__textarea:focus,
.dtc__input:focus,
.dtc__select:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.dtc__select {
  appearance: none;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--qt-muted) 50%),
    linear-gradient(135deg, var(--qt-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) 50%,
    calc(100% - 13px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 32px;
}
.dtc__row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.dtc__btn {
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
.dtc__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.dtc__btn:active:not(:disabled) {
  transform: translateY(0);
}
.dtc__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dtc__btn--ghost {
  background: transparent;
  color: var(--qt-text);
  border-color: var(--qt-border);
}
.dtc__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
.dtc__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
}
.dtc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.dtc__results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.dtc__row-out {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dtc__row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dtc__row-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
}
.dtc__row-hint {
  font-size: 11px;
  color: var(--qt-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dtc__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
.dtc__field--custom-out {
  margin-top: 4px;
}
</style>
