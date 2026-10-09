<script setup lang="ts">
/**
 * What3WordsEncoder - lat/lon ↔ three-word address via what3words API.
 */
import { ExternalLink, Key, Loader2, RotateCcw } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import ResultRow from '@/components/ResultRow.vue';
import { useWhat3WordsEncoder } from './useWhat3WordsEncoder';

const { mode, apiKey, latInput, lonInput, wordsInput, language, snapshot, reset, execute } = useWhat3WordsEncoder();

const { t } = useI18n();
const U = 'tools.what3words-encoder.ui.';

const LANG_OPTIONS = [
  { code: 'en', key: 'langEn' },
  { code: 'de', key: 'langDe' },
  { code: 'fr', key: 'langFr' },
  { code: 'es', key: 'langEs' },
  { code: 'it', key: 'langIt' },
  { code: 'pt', key: 'langPt' },
  { code: 'ru', key: 'langRu' },
  { code: 'ar', key: 'langAr' },
  { code: 'zh', key: 'langZh' },
  { code: 'ja', key: 'langJa' },
  { code: 'ko', key: 'langKo' },
] as const;

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok && !snapshot.value.loading);
const isEmpty = computed(() => snapshot.value === null);
const isLoading = computed(() => snapshot.value?.loading ?? false);

const outputDesc = computed(() => {
  if (isEmpty.value) return t(U + 'descEmpty');
  if (isLoading.value) return t(U + 'descLoading');
  if (hasError.value) return t(U + 'descError');
  return t(U + 'descDone');
});

const copyLabel = computed(() =>
  mode.value === 'encode' ? t(U + 'copyWords') : t(U + 'copyCoords'),
);

const resultLabel = computed(() =>
  mode.value === 'encode' ? t(U + 'wordsLabel') : t(U + 'resultCoords'),
);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return mode.value === 'encode' ? (snapshot.value.words ?? '') : `${snapshot.value.lat}, ${snapshot.value.lon}`;
});

</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton :title="t('common.reset')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </ToolButton>
        <ToolButton variant="primary" :title="t('common.convert')" @click="execute">
          <span>{{ t('common.convert') }}</span>
        </ToolButton>
      </template>

      <div class="qt-row qt-row--bottom" style="--qt-row-gap:10px">
        <label class="qt-field" style="flex:1 1 100%;min-width:120px">
          <span class="qt-label" style="display:inline-flex;align-items:center;gap:4px">
            <Key :size="12" />
            {{ t(U + 'apiKeyLabel') }}
          </span>
          <input v-model="apiKey" type="password" class="qt-input" style="width:100%;font-size:14px;padding:8px 10px" :placeholder="t(U + 'apiKeyPlaceholder')" />
        </label>
        <a href="https://developer.what3words.com/" target="_blank" rel="noopener" class="w3w__link">
          <ExternalLink :size="12" />
          {{ t(U + 'getKey') }}
        </a>
      </div>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field" style="flex:1;min-width:120px">
          <span class="qt-label">{{ t(U + 'modeLabel') }}</span>
          <select v-model="mode" class="qt-input" style="width:100%;font-size:14px;padding:8px 10px">
            <option value="encode">{{ t(U + 'modeEncode') }}</option>
            <option value="decode">{{ t(U + 'modeDecode') }}</option>
          </select>
        </label>
      </div>

      <template v-if="mode === 'encode'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="latInput"
            :label="t(U + 'latitude')"
            type="number"
            :placeholder="t(U + 'phLat')"
            step="any"
            min="-90"
            max="90"
            inputmode="decimal"
            grow
          />
          <ToolField
            v-model="lonInput"
            :label="t(U + 'longitude')"
            type="number"
            :placeholder="t(U + 'phLon')"
            step="any"
            min="-180"
            max="180"
            inputmode="decimal"
            grow
          />
          <label class="qt-field" style="flex:1;min-width:120px">
            <span class="qt-label">{{ t(U + 'languageLabel') }}</span>
            <select v-model="language" class="qt-input" style="width:100%;font-size:14px;padding:8px 10px">
              <option v-for="l in LANG_OPTIONS" :key="l.code" :value="l.code">
                {{ t(U + l.key) }}
              </option>
            </select>
          </label>
        </div>
      </template>
      <template v-else>
        <div class="qt-row" style="--qt-row-gap:10px">
          <ToolField
            v-model="wordsInput"
            :label="t(U + 'wordsLabel')"
            :placeholder="t(U + 'wordsPlaceholder')"
            grow
          />
        </div>
      </template>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="outputDesc"
      :copy-text="copyText"
      :copy-label="copyLabel"
    >
      <p v-if="isLoading" class="qt-hint" style="display:flex;align-items:center;gap:8px;margin:0;font-size:13.5px">
        <Loader2 :size="14" class="qt-spin" />
        <span>{{ t(U + 'querying') }}</span>
      </p>
      <ToolAlert v-else-if="hasError" kind="error">{{ snapshot?.message }}</ToolAlert>
      <ToolAlert v-else-if="isEmpty" kind="empty">
        {{ t(U + 'emptyAlert') }}
      </ToolAlert>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px;--qt-grid-gap:10px">
          <div class="w3w__hero">
            <ResultRow
              :label="resultLabel"
              :value="mode === 'encode' ? snapshot!.words! : `${snapshot!.lat}, ${snapshot!.lon}`"
              size="sm"
            />
          </div>
          <ResultRow v-if="snapshot!.country" :label="t(U + 'country')" :value="snapshot!.country" size="sm" />
          <ResultRow v-if="snapshot!.nearestPlace" :label="t(U + 'nearestPlace')" :value="snapshot!.nearestPlace" size="sm" />
          <ResultRow v-if="snapshot!.language" :label="t(U + 'languageLabel')" :value="snapshot!.language" size="sm" />
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: link hover underline and the hero ResultRow accent border
   (:deep override into a shared component). */
.w3w__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--qt-accent);
  text-decoration: none;
  white-space: nowrap;
  padding-bottom: 10px;
}
.w3w__link:hover {
  text-decoration: underline;
}
.w3w__hero :deep(.rr) {
  border-width: 2px;
  border-color: var(--qt-accent);
}
</style>
