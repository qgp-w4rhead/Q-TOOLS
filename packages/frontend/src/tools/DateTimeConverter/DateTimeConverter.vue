<script setup lang="ts">
/**
 * DateTimeConverter - convert between date-time formats and timezones.
 *
 * Inputs: ISO 8601, Unix seconds, Unix milliseconds, custom token format, or
 * auto-detect. Outputs: ISO 8601, Unix seconds, Unix ms, RFC 2822, custom
 * token format, relative time. Timezone selectable across all IANA zones.
 *
 * No external dependencies - uses only `Date` and the `Intl` API.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the input and
 * settings, and sends `output` PostMessages whenever the computed outputs
 * change.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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

const { t } = useI18n();
const U = 'tools.date-time-converter.ui.';

/** Localized label for an input-format option. */
const FORMAT_LABELS: Record<InputFormat, string> = {
  auto: 'fmtAuto',
  iso: 'fmtIso',
  'unix-seconds': 'fmtUnixSeconds',
  'unix-ms': 'fmtUnixMs',
  custom: 'fmtCustom',
};
/** Format ids whose hint is a translatable phrase (others are literal examples). */
const FORMAT_HINT_KEYS: Partial<Record<InputFormat, string>> = {
  auto: 'fmtAutoHint',
  custom: 'fmtCustomHint',
};
function formatLabel(f: { id: InputFormat }): string {
  return t(U + FORMAT_LABELS[f.id]);
}
function formatHint(f: { id: InputFormat; hint: string }): string {
  const key = FORMAT_HINT_KEYS[f.id];
  return key ? t(U + key) : f.hint;
}

/** Whether the custom-format input should be shown (only in custom mode). */
const showCustomInput = computed(() => format.value === 'custom');

/** Output rows for the results grid. */
const outputRows = computed(() => {
  const o = outputs.value;
  if (!o) return [];
  return [
    { key: 'iso', label: t(U + 'iso'), value: o.iso, hint: timeZone.value },
    { key: 'unixSeconds', label: t(U + 'unixSeconds'), value: o.unixSeconds, hint: 's' },
    { key: 'unixMs', label: t(U + 'unixMs'), value: o.unixMs, hint: 'ms' },
    { key: 'rfc2822', label: t(U + 'rfc2822'), value: o.rfc2822, hint: t(U + 'hintEmail') },
    { key: 'custom', label: t(U + 'customFormat'), value: o.custom, hint: outputCustomFormat.value },
    { key: 'relative', label: t(U + 'relative'), value: o.relative, hint: t(U + 'hintFromNow') },
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
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button class="qt-btn qt-btn--ghost" type="button" :title="t(U + 'nowTitle')" @click="now">
          <Clock :size="14" />
          <span>{{ t('common.now') }}</span>
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t('common.convert') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'inputLabel') }}</span>
        <textarea
          class="qt-input qt-input--mono dtc__textarea"
          rows="3"
          :placeholder="t(U + 'placeholder')"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>

      <div class="qt-row" style="--qt-row-gap:12px">
        <label class="qt-field dtc__field--grow">
          <span class="qt-label">{{ t(U + 'inputFormat') }}</span>
          <select class="qt-input" :value="format" @change="onFormatChange">
            <option v-for="f in INPUT_FORMATS" :key="f.id" :value="f.id">
              {{ formatLabel(f) }} - {{ formatHint(f) }}
            </option>
          </select>
        </label>

        <label class="qt-field dtc__field--grow">
          <span class="qt-label">{{ t(U + 'timezone') }}</span>
          <select class="qt-input" :value="timeZone" @change="onTimeZoneChange">
            <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
          </select>
        </label>
      </div>

      <label v-if="showCustomInput" class="qt-field">
        <span class="qt-label">{{ t(U + 'customFormatLabel') }}</span>
        <input
          class="qt-input"
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
      :title="t(U + 'outputTitle')"
      :description="date ? t(U + 'outputDescParsed', { iso: date.toISOString() }) : t(U + 'outputDescEmpty')"
      :copy-text="outputs?.iso ?? ''"
      :copy-label="t(U + 'copyIso')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <p v-else-if="!outputs" class="qt-alert qt-alert--empty">
        {{ t(U + 'empty') }}
      </p>
      <div v-else class="qt-grid" style="--qt-grid-min:280px;--qt-grid-gap:10px">
        <div v-for="row in outputRows" :key="row.key" class="qt-result">
          <div class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:8px">
            <span class="dtc__row-label">{{ row.label }}</span>
            <span class="dtc__row-hint">{{ row.hint }}</span>
            <CopyButton :text="row.value" :label="t('common.copy')" icon-only />
          </div>
          <code class="qt-mono dtc__code">{{ row.value || '-' }}</code>
        </div>
      </div>

      <label v-if="outputs" class="qt-field dtc__field--custom-out">
        <span class="qt-label">{{ t(U + 'outCustomFormatLabel') }}</span>
        <input
          class="qt-input"
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
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Field sizing modifiers (layout via .qt-field). */
.dtc__field--grow {
  flex: 1;
  min-width: 0;
}
.dtc__field--custom-out {
  margin-top: 4px;
}
/* Input textarea floor (control + mono via .qt-input--mono). */
.dtc__textarea {
  min-height: 72px;
}
/* Output-row internals (card via .qt-result). */
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
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
