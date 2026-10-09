<script setup lang="ts">
/**
 * WhatXWord - fully offline three-word coordinate encoder/decoder.
 */
import { AlertCircle, Lightbulb, RotateCcw, Sparkles, Wand2 } from 'lucide-vue-next';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useWhatXWord,
  getWordCount,
} from './useWhatXWord';

const { mode, autoDetect, detectedType, latInput, lonInput, wordsInput, precision, wordPack, snapshot, reset } = useWhatXWord();

const { t, locale } = useI18n();
const U = 'tools.whatxword-encoder.ui.';

const hasError = computed(() => snapshot.value !== null && !snapshot.value.ok);
const isEmpty = computed(() => snapshot.value === null);
const hasSuggestions = computed(() => snapshot.value?.suggestions && snapshot.value.suggestions.length > 0);

const copyText = computed(() => {
  if (snapshot.value === null || !snapshot.value.ok) return '';
  return mode.value === 'encode' ? (snapshot.value.words ?? '') : `${snapshot.value.lat}, ${snapshot.value.lon}`;
});

const wordCountLabel = computed(() => {
  const count = getWordCount(wordPack.value);
  return count.toLocaleString(locale.value);
});

const detectedTypeLabel = computed(() =>
  detectedType.value === 'words' ? t(U + 'typeWords') : t(U + 'typeCoords'),
);
const modeLabel = computed(() =>
  mode.value === 'encode' ? t(U + 'modeEncodeShort') : t(U + 'modeDecodeShort'),
);

function onMode(e: Event): void { mode.value = (e.target as HTMLSelectElement).value as 'encode' | 'decode'; }
function onAutoDetect(e: Event): void { autoDetect.value = (e.target as HTMLInputElement).checked; }
function onLat(e: Event): void { latInput.value = (e.target as HTMLInputElement).value; }
function onLon(e: Event): void { lonInput.value = (e.target as HTMLInputElement).value; }
function onWords(e: Event): void { wordsInput.value = (e.target as HTMLInputElement).value; }
function onPrecision(e: Event): void { precision.value = parseInt((e.target as HTMLSelectElement).value, 10); }
function onPack(e: Event): void { wordPack.value = (e.target as HTMLSelectElement).value as typeof wordPack.value; }

function applySuggestion(groupIndex: number, word: string): void {
  const positions = snapshot.value?.unknownPositions;
  if (!positions || groupIndex >= positions.length) return;
  const pos = positions[groupIndex]!;
  const parts = wordsInput.value.trim().toLowerCase().split('.');
  if (parts.length !== 3) return;
  parts[pos] = word;
  wordsInput.value = parts.join('.');
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button type="button" class="qt-btn qt-btn--outline" :title="t(U + 'resetTitle')" @click="reset">
          <RotateCcw :size="14" />
          <span>{{ t('common.reset') }}</span>
        </button>
      </template>

      <div class="qt-row" style="--qt-row-gap:10px">
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'mode') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 10px" :value="mode" :disabled="autoDetect" @change="onMode">
            <option value="encode">{{ t(U + 'modeEncode') }}</option>
            <option value="decode">{{ t(U + 'modeDecode') }}</option>
          </select>
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'wordPack') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 10px" :value="wordPack" @change="onPack">
            <option value="classic">{{ t(U + 'packClassic') }}</option>
            <option value="crisp">{{ t(U + 'packCrisp') }}</option>
            <option value="flowing">{{ t(U + 'packFlowing') }}</option>
          </select>
        </label>
        <label class="qt-field qt-field--grow">
          <span class="qt-label">{{ t(U + 'precision') }}</span>
          <select class="qt-input" style="font-size:14px;padding:8px 10px" :value="precision" @change="onPrecision">
            <option :value="1">{{ t(U + 'prec1') }}</option>
            <option :value="3">{{ t(U + 'prec3') }}</option>
            <option :value="10">{{ t(U + 'prec10') }}</option>
            <option :value="50">{{ t(U + 'prec50') }}</option>
            <option :value="100">{{ t(U + 'prec100') }}</option>
          </select>
        </label>
        <label class="qt-check" style="align-self:flex-end;padding-bottom:8px">
          <input type="checkbox" :checked="autoDetect" @change="onAutoDetect" />
          <span class="qt-label"><Wand2 :size="12" /> {{ t(U + 'autoDetect') }}</span>
        </label>
      </div>

      <div v-if="autoDetect && detectedType !== 'unknown'" class="qt-banner" style="color:var(--qt-accent);background:oklch(from var(--qt-accent) 90% c h / 0.1);font-size:12px;padding:6px 10px">
        <Wand2 :size="12" />
        <span>{{ t(U + 'detected') }} <strong>{{ detectedTypeLabel }}</strong> {{ t(U + 'switchedMiddle') }} <strong>{{ modeLabel }}</strong> {{ t(U + 'switchedSuffix') }}</span>
      </div>

      <template v-if="mode === 'encode'">
        <div class="qt-row" style="--qt-row-gap:10px">
          <label class="qt-field qt-field--grow">
            <span class="qt-label">{{ t(U + 'latitude') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :placeholder="t(U + 'phLat')" step="any" min="-90" max="90" :value="latInput" inputmode="decimal" @input="onLat" />
          </label>
          <label class="qt-field qt-field--grow">
            <span class="qt-label">{{ t(U + 'longitude') }}</span>
            <input type="number" class="qt-input" style="font-size:14px;padding:8px 10px" :placeholder="t(U + 'phLon')" step="any" min="-180" max="180" :value="lonInput" inputmode="decimal" @input="onLon" />
          </label>
        </div>
      </template>
      <template v-else>
        <div class="qt-row" style="--qt-row-gap:10px">
          <label class="qt-field" style="flex:1 1 100%">
            <span class="qt-label">{{ t(U + 'threeWordAddr') }}</span>
            <input type="text" class="qt-input" style="font-size:14px;padding:8px 10px" :placeholder="t(U + 'phWords')" :value="wordsInput" @input="onWords" />
          </label>
        </div>
      </template>
    </ToolInput>

    <ToolOutput
      :title="t('common.result')"
      :description="isEmpty ? t(U + 'descEmpty') : (hasError ? t(U + 'descAdjust') : t(U + 'descDone'))"
      :copy-text="copyText"
      :copy-label="mode === 'encode' ? t(U + 'copyWords') : t(U + 'copyCoords')"
    >
      <p v-if="hasError" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ snapshot?.message }}</span>
      </p>
      <div v-if="hasSuggestions" class="qt-panel" style="margin-top:8px;padding:10px">
        <div class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap;font-size:12px;font-weight:600;color:var(--qt-muted);margin-bottom:8px">
          <Lightbulb :size="12" />
          <span>{{ t(U + 'didYouMean') }}</span>
        </div>
        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div v-for="(group, gi) in snapshot!.suggestions" :key="gi" class="qt-row" style="--qt-row-gap:6px">
            <button
              v-for="s in group"
              :key="s.word"
              type="button"
              class="qt-btn qt-btn--outline qt-mono"
              style="font-size:13px;padding:4px 10px"
              @click="applySuggestion(gi, s.word)"
            >
              {{ s.word }}
              <span class="qt-hint" style="font-size:10px">d={{ s.distance }}</span>
            </button>
          </div>
        </div>
      </div>
      <p v-else-if="isEmpty" class="qt-alert qt-alert--empty">{{ t(U + 'emptyAlert') }}</p>
      <template v-else>
        <div class="qt-grid" style="--qt-grid-min:140px">
          <div class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:10px;border-width:2px;border-color:var(--qt-accent)">
            <span class="qt-label" style="font-size:12px">{{ mode === 'encode' ? t(U + 'lblWords') : t(U + 'lblCoords') }}</span>
            <span class="qt-mono" style="font-size:14px;font-weight:600;color:var(--qt-text);word-break:break-all">{{ mode === 'encode' ? snapshot!.words : `${snapshot!.lat}, ${snapshot!.lon}` }}</span>
          </div>
          <div class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:10px">
            <span class="qt-label" style="font-size:12px">{{ t(U + 'precision') }}</span>
            <span class="qt-mono" style="font-size:14px;font-weight:600;color:var(--qt-text);word-break:break-all">{{ t(U + 'precisionCells', { n: snapshot!.precision }) }}</span>
          </div>
          <div class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:10px">
            <span class="qt-label" style="font-size:12px">{{ t(U + 'wordPack') }}</span>
            <span class="qt-mono" style="font-size:14px;font-weight:600;color:var(--qt-text);word-break:break-all">{{ snapshot!.wordPack }}</span>
          </div>
          <div class="qt-panel qt-stack" style="--qt-stack-gap:4px;padding:10px">
            <span class="qt-label" style="font-size:12px">{{ t(U + 'wordListSize') }}</span>
            <span class="qt-mono" style="font-size:14px;font-weight:600;color:var(--qt-text);word-break:break-all">{{ t(U + 'wordsCount', { n: wordCountLabel }) }}</span>
          </div>
        </div>
        <div class="qt-hint" style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px">
          <Sparkles :size="12" />
          <span>{{ t(U + 'offlineHint') }}</span>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>
