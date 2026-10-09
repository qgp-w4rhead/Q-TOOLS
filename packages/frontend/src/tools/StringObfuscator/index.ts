/**
 * StringObfuscator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 *
 * Obfuscates text by replacing ASCII characters with visually-similar Unicode
 * homoglyphs (Cyrillic/Greek/IPA/Armenian lookalikes) and/or inserting
 * zero-width characters between visible characters. Provides a deobfuscate
 * mode that strips zero-width characters and reverses homoglyph substitution.
 *
 * No external dependencies - pure string + Unicode code-point arithmetic.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'string-obfuscator',
  name: 'String obfuscator',
  description:
    'Obfuscate text with Unicode homoglyph substitutions and zero-width character insertion. Reversible deobfuscate mode.',
  category: 'text',
  icon: 'eye-off',
  keywords: [
    'string', 'obfuscate', 'deobfuscate', 'homoglyph', 'lookalike',
    'zero-width', 'unicode', 'confusable', 'disguise', 'encode', 'decode',
  ],
  dependencies: [],
};

export {
  useStringObfuscator,
  obfuscate,
  obfuscateHomoglyph,
  obfuscateZeroWidth,
  deobfuscate,
  HOMOGLYPHS,
  REVERSE_HOMOGLYPHS,
  ZERO_WIDTH_CHARS,
} from './useStringObfuscator';
export type {
  ObfuscationMethod,
  Intensity,
  ObfuscatorMode,
  ObfuscatorOptions,
  UseStringObfuscatorReturn,
} from './useStringObfuscator';

const StringObfuscator = defineAsyncComponent(
  () => import('./StringObfuscator.vue'),
);

export default StringObfuscator;
