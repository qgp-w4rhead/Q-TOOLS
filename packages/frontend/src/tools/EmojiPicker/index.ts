/**
 * EmojiPicker tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Browse, search, and copy emojis across 9 categories (smileys, people,
 * animals, food, activities, travel, objects, symbols, flags) with a skin-tone
 * selector and copy-as-shortcode mode. The emoji dataset is lazy-loaded as a
 * separate Vite chunk (~100 KB source / ~30 KB gzip).
 *
 * No external dependencies - the dataset is bundled and hand-curated.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'emoji-picker',
  name: 'Emoji picker',
  description:
    'Browse, search, and copy emojis across 9 categories with skin-tone selector and shortcode copy mode.',
  category: 'text',
  icon: 'smile',
  keywords: [
    'emoji', 'picker', 'copy', 'shortcode', 'skin-tone', 'smileys',
    'people', 'animals', 'food', 'activities', 'travel', 'objects',
    'symbols', 'flags', 'search',
  ],
  dependencies: [],
};

export {
  useEmojiPicker,
  applySkinTone,
  normalizeQuery,
  searchEmojis,
  flattenCategory,
  categoryCount,
} from './useEmojiPicker';
export type {
  CopyMode,
  SearchResult,
  UseEmojiPickerReturn,
} from './useEmojiPicker';
export type {
  EmojiEntry,
  EmojiCategory,
  EmojiCategoryData,
  SkinTone,
} from './emojiData';
export {
  EMOJI_CATEGORIES,
  CATEGORY_LABELS,
  SKIN_TONES,
} from './emojiData';

const EmojiPicker = defineAsyncComponent(
  () => import('./EmojiPicker.vue'),
);

export default EmojiPicker;
