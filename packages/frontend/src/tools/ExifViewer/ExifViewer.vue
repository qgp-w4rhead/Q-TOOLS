<script setup lang="ts">
/**
 * ExifViewer - inspect EXIF metadata embedded in a photo (JPEG APP1 or PNG
 * eXIf) via a hand-rolled TIFF/IFD parser. Groups fields into Camera, Lens,
 * Exposure, Dates, Image, and GPS sections; shows a map link when GPS
 * coordinates are present. Everything runs locally - no uploads.
 *
 * Embed mode: sends `{ entries, gps, tagCount }` outputs; accepts `reset`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, AlertTriangle, Info, MapPin } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useExifViewer, formatGpsCoord } from './useExifViewer';
import { formatBytes } from '@/utils/media';

const {
  fileName,
  fileSizeBytes,
  previewUrl,
  hasFile,
  result,
  error,
  setFile,
  reset,
} = useExifViewer();

const { t } = useI18n();
const U = 'tools.exif-viewer.ui.';

const GROUP_KEYS: Record<string, string> = {
  camera: 'camera',
  lens: 'lens',
  exposure: 'exposure',
  dates: 'dates',
  image: 'image',
  gps: 'gps',
};
function groupLabel(group: string): string {
  const key = GROUP_KEYS[group.toLowerCase()];
  return key ? t(`${U}groups.${key}`) : group;
}

const groups = computed(() => {
  const out = new Map<string, { label: string; value: string }[]>();
  for (const e of result.value?.entries ?? []) {
    const list = out.get(e.group) ?? [];
    list.push({ label: e.label, value: e.value });
    out.set(e.group, list);
  }
  return [...out.entries()].map(([group, rows]) => ({ group, rows }));
});

const gpsLink = computed(() => {
  const g = result.value?.gps;
  if (!g) return null;
  return `https://www.openstreetmap.org/?mlat=${g.lat}&mlon=${g.lon}#map=15/${g.lat}/${g.lon}`;
});

const allText = computed(() =>
  (result.value?.entries ?? []).map((e) => `${e.group} · ${e.label}: ${e.value}`).join('\n'),
);

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
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        :title="t(U + 'dropTitle')"
        :hint="t(U + 'dropHint')"
        @files="onFiles"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="hasFile ? t(U + 'descFile', { name: fileName, size: formatBytes(fileSizeBytes) }) : t(U + 'descEmpty')"
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

      <div v-if="hasFile" class="exif__body">
        <div class="qt-stack" style="--qt-stack-gap:8px;min-width:0">
          <img v-if="previewUrl" :src="previewUrl" class="exif__preview" :alt="fileName" />
          <a
            v-if="gpsLink"
            :href="gpsLink"
            target="_blank"
            rel="noopener noreferrer"
            class="exif__map-link"
          >
            <MapPin :size="13" />
            {{ formatGpsCoord(result!.gps!.lat, true) }}, {{ formatGpsCoord(result!.gps!.lon, false) }}
          </a>
        </div>

        <div v-if="result" class="qt-stack" style="--qt-stack-gap:14px;min-width:0">
          <div v-for="g in groups" :key="g.group">
            <h3 class="qt-stat-head" style="margin:0 0 6px">{{ groupLabel(g.group) }}</h3>
            <dl class="qt-panel" style="margin:0;padding:0;overflow:hidden">
              <div v-for="row in g.rows" :key="row.label" class="exif__row">
                <dt class="qt-label" style="min-width:0">{{ row.label }}</dt>
                <dd class="qt-row qt-row--center qt-row--between" style="--qt-row-gap:8px;margin:0;min-width:0;word-break:break-word">
                  <span>{{ row.value }}</span>
                  <CopyButton :text="row.value" label="" style="flex-shrink:0" />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div v-if="!hasFile && !error" class="exif__placeholder">
        <Info :size="36" class="exif__placeholder-icon" />
        <span>{{ t(U + 'empty') }}</span>
      </div>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Body — sidebar (preview + GPS) beside the metadata groups. */
.exif__body {
  display: grid;
  grid-template-columns: minmax(140px, 220px) 1fr;
  gap: 16px;
}
@media (max-width: 640px) {
  .exif__body {
    grid-template-columns: 1fr;
  }
}
/* Photo preview — checkerboard backdrop for transparency. */
.exif__preview {
  display: block;
  width: 100%;
  object-fit: contain;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius);
  background: repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%) 0 0 / 16px 16px;
}
/* GPS map link — accent text link with tabular coords. */
.exif__map-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-accent);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.exif__map-link:hover {
  text-decoration: underline;
}
/* Metadata field row — 2-col grid, zebra-striped. */
.exif__row {
  display: grid;
  grid-template-columns: minmax(120px, 40%) 1fr;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12.5px;
}
.exif__row:nth-child(odd) {
  background: var(--qt-bg);
}
/* Centered empty state — big icon + prompt. */
.exif__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 32px 16px;
  color: var(--qt-muted);
  font-size: 13px;
  text-align: center;
}
.exif__placeholder-icon {
  opacity: 0.4;
}
</style>
