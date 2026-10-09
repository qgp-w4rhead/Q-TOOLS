/**
 * Bip39Generator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'bip39-generator',
  name: 'BIP39 passphrase generator',
  description: 'Generate BIP39 mnemonic phrases (12-24 words).',
  category: 'crypto',
  icon: 'key-round',
  keywords: ['bip39', 'mnemonic', 'seed', 'wallet'],
  dependencies: ['@scure/bip39'],
};

export {
  useBip39Generator,
  ensureBip39Module,
  loadWordlist,
  generateMnemonicPhrase,
  mnemonicToEntropyHex,
  entropyHexToMnemonic,
  validateMnemonicPhrase,
  deriveSeed,
  toHex,
  fromHex,
  STRENGTHS,
  DEFAULT_STRENGTH,
  STRENGTH_TO_WORDS,
  WORDLISTS,
  DEFAULT_WORDLIST,
  WORDLIST_LABELS,
} from './useBip39Generator';
export type {
  Strength,
  WordlistId,
  GenerateMnemonicOptions,
  UseBip39GeneratorReturn,
} from './useBip39Generator';

const Bip39Generator = defineAsyncComponent(() => import('./Bip39Generator.vue'));

export default Bip39Generator;
