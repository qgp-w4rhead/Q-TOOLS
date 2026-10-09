<script setup lang="ts">
/**
 * FaviconGenerator - turn one PNG (or any decodable image) into a full
 * favicon set: PNGs at 16/32/48/180/192/512 px, a `favicon.ico` container
 * (PNG-in-ICO, hand-rolled writer), a `site.webmanifest` JSON snippet, and
 * a `<head>` HTML snippet. Everything runs locally in the browser.
 *
 * Embed mode: accepts `appName`/`action` inputs and sends status outputs
 * including the manifest + HTML snippet text.
 */
import { useI18n } from 'vue-i18n';
import { Download, Trash2, AlertTriangle, Star, Zap } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useFaviconGenerator } from './useFaviconGenerator';

const {
  fileName,
  hasFile,
  imageWidth,
  imageHeight,
  appName,
  icons,
  icoBlob,
  manifestText,
  htmlSnippet,
  isGenerating,
  error,
  setFile,
  generate,
  downloadIcon,
  downloadIco,
  downloadManifest,
  reset,
} = useFaviconGenerator();

const { t } = useI18n();
const U = 'tools.favicon-generator.ui.';

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

      <div v-if="hasFile" class="qt-grid" style="--qt-grid-min:200px;--qt-grid-gap:12px">
        <label class="qt-field">
          <span class="qt-label">{{ t(U + 'appName') }}</span>
          <input v-model="appName" class="qt-input" type="text" :placeholder="t(U + 'appNamePlaceholder')" />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descFile', { name: fileName, w: imageWidth, h: imageHeight }) : t('common.noImageLoaded')"
      hide-copy
    >
      <template #actions>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm fav__btn--primary"
          :disabled="!hasFile || isGenerating"
          @click="generate"
        >
          <Zap :size="14" /> {{ isGenerating ? t('common.generating') : t('common.generate') }}
        </button>
        <button
          type="button"
          class="qt-btn qt-btn--ghost qt-btn--sm"
          :disabled="!icoBlob"
          :title="t(U + 'downloadIcoTitle')"
          @click="downloadIco"
        >
          <Download :size="14" /> favicon.ico
        </button>
        <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" :disabled="!hasFile" :title="t('common.clear')" @click="reset">
          <Trash2 :size="14" /> {{ t('common.clear') }}
        </button>
      </template>

      <div v-if="error" class="qt-banner qt-banner--warn">
        <AlertTriangle :size="16" />
        <span>{{ error }}</span>
      </div>

      <div v-if="icons.length" class="qt-grid" style="--qt-grid-min:110px;--qt-grid-gap:10px">
        <div v-for="icon in icons" :key="icon.size" class="qt-panel qt-stack" style="--qt-stack-gap:4px;align-items:center;padding:10px;text-align:center">
          <img :src="icon.objectUrl" class="fav__thumb" :alt="icon.fileName" />
          <span class="fav__cell-label">{{ icon.size }}×{{ icon.size }}</span>
          <span class="fav__cell-sub">{{ icon.label }}</span>
          <button type="button" class="qt-btn qt-btn--ghost qt-btn--icon" style="margin-top:2px" :title="t(U + 'downloadPngTitle')" @click="downloadIcon(icon)">
            <Download :size="12" />
          </button>
        </div>
      </div>

      <div v-if="manifestText" class="qt-stack" style="--qt-stack-gap:6px">
        <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px">
          <span class="qt-stat-head">site.webmanifest</span>
          <span class="qt-row qt-row--nowrap" style="--qt-row-gap:6px">
            <CopyButton :text="manifestText" :label="t('common.copy')" />
            <button type="button" class="qt-btn qt-btn--ghost qt-btn--sm" @click="downloadManifest">
              <Download :size="12" /> {{ t('common.download') }}
            </button>
          </span>
        </div>
        <pre class="qt-output fav__code">{{ manifestText }}</pre>
      </div>

      <div v-if="htmlSnippet" class="qt-stack" style="--qt-stack-gap:6px">
        <div class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px">
          <span class="qt-stat-head">{{ t(U + 'headSnippet') }}</span>
          <CopyButton :text="htmlSnippet" :label="t('common.copy')" />
        </div>
        <pre class="qt-output fav__code">{{ htmlSnippet }}</pre>
      </div>

      <div v-if="!hasFile" class="fav__placeholder">
        <Star :size="36" class="fav__placeholder-icon" />
        <span>{{ t('common.loadImageStart') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Generate action (base via .qt-btn--ghost) — accent outline. */
.fav__btn--primary {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
}
/* Favicon thumb — pixel-perfect, checkerboard backdrop. */
.fav__thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 12px 12px;
  border-radius: var(--qt-radius-sm);
}
/* Cell captions — size (bold tabular) + purpose (tiny muted). */
.fav__cell-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--qt-text);
  font-variant-numeric: tabular-nums;
}
.fav__cell-sub {
  font-size: 10px;
  color: var(--qt-muted);
}
/* Snippet code (base via .qt-output) — no-wrap, scrollable. */
.fav__code {
  margin: 0;
  font-size: 11.5px;
  white-space: pre;
}
/* Centered empty state — big icon + prompt. */
.fav__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.fav__placeholder-icon {
  opacity: 0.4;
}
</style>
