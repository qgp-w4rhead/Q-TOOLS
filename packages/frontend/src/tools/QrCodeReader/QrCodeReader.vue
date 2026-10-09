<script setup lang="ts">
/**
 * QrCodeReader - decode QR codes and barcodes from an uploaded image via
 * the native `BarcodeDetector` API (zero dependencies). Shows each decoded
 * value with its symbology, a copy button, and an "open link" affordance
 * for URL payloads. Everything runs locally - nothing leaves the browser.
 *
 * Embed mode: sends `{ codes, count }` outputs; accepts `reset`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, AlertTriangle, ScanLine, ExternalLink } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useQrCodeReader, formatName, looksLikeUrl } from './useQrCodeReader';
import { formatBytes } from '@/utils/media';

const {
  fileName,
  fileSizeBytes,
  previewUrl,
  hasFile,
  codes,
  supported,
  supportedFormats,
  isDecoding,
  error,
  setFile,
  reset,
} = useQrCodeReader();

const { t } = useI18n();
const U = 'tools.qr-code-reader.ui.';

const allText = computed(() => codes.value.map((c) => c.value).join('\n'));

function onFiles(files: File[]): void {
  const f = files[0];
  if (f) void setFile(f);
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t('common.input')"
      :description="t(U + 'desc')"
    >
      <FileDropZone
        accept="image/*"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />

      <div v-if="!supported" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ t(U + 'unsupportedBrowser') }}</span>
      </div>
      <p v-else-if="supportedFormats.length" class="qt-hint" style="margin:0">
        {{ t(U + 'supportedLabel', { formats: supportedFormats.map(formatName).join(', ') }) }}
      </p>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descFile', { name: fileName, size: formatBytes(fileSizeBytes) }) : t('common.noImageLoaded')"
      :copy-text="allText"
      :copy-label="t('common.copyAll')"
    >
      <template #actions>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!hasFile" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="hasFile" class="qt-stack" style="--qt-stack-gap:12px">
        <img :src="previewUrl!" class="qrread__preview" :alt="fileName" />
        <ul v-if="codes.length" class="qt-list qt-stack" style="--qt-stack-gap:6px">
          <li v-for="(c, i) in codes" :key="i" class="qt-panel qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:10px;padding:8px 10px">
            <span class="qrread__format">{{ formatName(c.format) }}</span>
            <span class="qt-mono qrread__value" :title="c.value">{{ c.value }}</span>
            <span class="qt-row qt-row--center qt-row--nowrap" style="--qt-row-gap:4px;flex-shrink:0">
              <a
                v-if="looksLikeUrl(c.value)"
                :href="c.value"
                target="_blank"
                rel="noopener noreferrer"
                class="qrread__open"
                :title="t(U + 'openLink')"
              >
                <ExternalLink :size="13" />
              </a>
              <CopyButton :text="c.value" label="" />
            </span>
          </li>
        </ul>
        <p v-else-if="isDecoding" class="qt-hint" style="margin:0;font-size:12.5px">{{ t(U + 'decoding') }}</p>
      </div>

      <div v-if="!hasFile && !error" class="qrread__placeholder">
        <ScanLine :size="36" class="qrread__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Source-image preview — checkerboard backdrop for transparency. */
.qrread__preview {
  display: block;
  max-width: 100%;
  max-height: 280px;
  object-fit: contain;
  align-self: flex-start;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
/* Symbology badge — accent-tinted uppercase pill. */
.qrread__format {
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 60% c h / 12%);
  border-radius: 999px;
}
/* Decoded value (font via .qt-mono) — grows, single-line ellipsis. */
.qrread__value {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: var(--qt-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Open-link icon button — accent, hover tint. */
.qrread__open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--qt-accent);
  border-radius: var(--qt-radius-sm);
}
.qrread__open:hover {
  background: oklch(from var(--qt-accent) 60% c h / 12%);
}
/* Centered empty state — big icon + prompt. */
.qrread__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.qrread__placeholder-icon {
  opacity: 0.4;
}
</style>
