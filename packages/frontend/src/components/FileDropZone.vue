<script setup lang="ts">
/**
 * FileDropZone - shared drag-and-drop / click-to-browse file picker.
 *
 * Used by the Audio & Video tools (and reusable by any file-based tool).
 * Emits the picked `File[]` list; the parent owns validation and state.
 * Pure presentational component - no logic beyond DOM event wiring.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { FileUp, Loader2 } from 'lucide-vue-next';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    /** `accept` attribute for the hidden file input (e.g. `"audio/*"` or `".mp4,.webm"`). */
    accept?: string;
    /** Allow selecting multiple files. */
    multiple?: boolean;
    /** Show a spinner instead of the upload icon. */
    busy?: boolean;
    /** Primary label. */
    title?: string;
    /** Secondary hint line. */
    hint?: string;
    /** Compact padding variant (for "add more" rows). */
    compact?: boolean;
  }>(),
  {
    accept: '',
    multiple: false,
    busy: false,
    compact: false,
  },
);

const titleText = computed(() => props.title ?? t('common.dropFile'));
const hintText = computed(() => props.hint ?? t('common.dropFileHint'));

const emit = defineEmits<{
  (e: 'files', files: File[]): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref<boolean>(false);

function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const list = e.dataTransfer?.files;
  if (list && list.length > 0) emit('files', Array.from(list));
}

function onPickerChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const list = input.files;
  if (list && list.length > 0) emit('files', Array.from(list));
  // Reset so picking the same file twice still fires `change`.
  input.value = '';
}

function pick(): void {
  if (props.busy) return;
  fileInput.value?.click();
}
</script>

<template>
  <div
    class="fdz"
    :class="{ 'fdz--over': dragOver, 'fdz--compact': compact, 'fdz--busy': busy }"
    role="button"
    tabindex="0"
    @click="pick"
    @keydown.enter="pick"
    @keydown.space.prevent="pick"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
  >
    <Loader2 v-if="busy" :size="compact ? 18 : 28" class="fdz__spin" />
    <FileUp v-else :size="compact ? 18 : 28" class="fdz__icon" />
    <p class="fdz__title">{{ busy ? t('common.working') : titleText }}</p>
    <p v-if="hintText" class="fdz__hint">{{ hintText }}</p>
    <input
      ref="fileInput"
      type="file"
      hidden
      :accept="accept"
      :multiple="multiple"
      @change="onPickerChange"
    />
  </div>
</template>

<style scoped>
.fdz {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1.5px dashed var(--qt-border);
  border-radius: var(--qt-radius);
  background: var(--qt-bg);
  color: var(--qt-muted);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  will-change: border-color;
}
.fdz--compact {
  padding: 14px 12px;
  flex-direction: row;
  gap: 10px;
}
.fdz:hover,
.fdz--over {
  border-color: var(--qt-accent);
  background: oklch(from var(--qt-accent) 95% c h / 0.08);
}
.fdz--busy {
  cursor: wait;
}
.fdz__icon {
  color: var(--qt-accent);
}
.fdz__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--qt-text);
}
.fdz--compact .fdz__title {
  font-size: 13px;
}
.fdz__hint {
  margin: 0;
  font-size: 12px;
}
.fdz--compact .fdz__hint {
  display: none;
}
.fdz__spin {
  color: var(--qt-accent);
  animation: fdz-spin 0.9s linear infinite;
}
@keyframes fdz-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
