/**
 * OutlookSafelinkDecoder tool module - exports the lazy-loaded component plus
 * its metadata and composable so the tool can be registered in the registry
 * and routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'outlook-safelink-decoder',
  name: 'Outlook Safelink decoder',
  description: 'Decode Outlook safelink wrapped URLs.',
  category: 'web',
  icon: 'mail',
  keywords: ['outlook', 'safelink', 'url', 'decode'],
  dependencies: [],
};

export {
  useOutlookSafelinkDecoder,
  isSafelinkUrl,
  decodeSafelink,
  parseSafelinkData,
  extractSafelink,
  SafelinkParseError,
} from './useOutlookSafelinkDecoder';
export type {
  ParsedSafelink,
  SafelinkData,
  SafelinkParseStage,
  UseOutlookSafelinkDecoderReturn,
} from './useOutlookSafelinkDecoder';

const OutlookSafelinkDecoder = defineAsyncComponent(
  () => import('./OutlookSafelinkDecoder.vue'),
);

export default OutlookSafelinkDecoder;
