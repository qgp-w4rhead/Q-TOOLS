/**
 * AsciiArtTextGenerator tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Renders text as ASCII art using the `figlet` package. The figlet core
 * module is lazy-loaded as its own Vite chunk (~5 KB); each font is loaded
 * on demand from `figlet/importable-fonts/<Name>.js` and registered with the
 * figlet runtime. A curated set of 26 popular fonts is offered via a
 * dropdown and a live preview gallery. Horizontal and vertical layout
 * (kerning / smushing) modes are configurable.
 *
 * Dependencies: `figlet` (lazy-loaded).
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'ascii-art-text-generator',
  name: 'ASCII Art Text Generator',
  description:
    'Render text as ASCII art with figlet. 26 curated fonts, live preview gallery, configurable horizontal/vertical kerning modes. Fonts loaded on demand.',
  category: 'text',
  icon: 'type',
  keywords: [
    'ascii', 'art', 'figlet', 'text', 'banner', 'font', 'block',
    'shadow', 'slant', 'big', 'small', 'script',
  ],
  dependencies: ['figlet'],
};

export {
  useAsciiArtTextGenerator,
  loadFiglet,
  loadFont,
  renderAsciiArt,
  resetFigletCache,
  clampInt,
  coerceKerning,
  coerceFont,
  CURATED_FONTS,
  KERNING_METHODS,
  DEFAULT_FONT,
  DEFAULT_SAMPLE,
} from './useAsciiArtTextGenerator';
export type {
  KerningMethod,
  AsciiArtOptions,
  FontPreview,
  UseAsciiArtTextGeneratorReturn,
} from './useAsciiArtTextGenerator';

const AsciiArtTextGenerator = defineAsyncComponent(
  () => import('./AsciiArtTextGenerator.vue'),
);

export default AsciiArtTextGenerator;
