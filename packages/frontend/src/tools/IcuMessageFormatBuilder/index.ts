/**
 * IcuMessageFormatBuilder tool module - exports the lazy-loaded component
 * plus its metadata and composable.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'icu-message-format-builder',
    name: 'ICU MessageFormat Builder',
    description:
      'Build/preview ICU MessageFormat strings with live rendering for plural, select, and date arguments.',
    category: 'i18n',
    icon: 'languages',
    keywords: ['icu', 'messageformat', 'plural', 'select', 'i18n', 'l10n', 'translation', 'intl'],
    dependencies: [],
  },
  () => import('./IcuMessageFormatBuilder.vue'),
);

export { metadata };

export {
  useIcuMessageFormatBuilder,
  parseIcuMessage,
  renderIcuMessage,
  astToString,
} from './useIcuMessageFormatBuilder';
export type {
  IcuVariable,
  IcuRenderResult,
  UseIcuMessageFormatBuilderReturn,
} from './useIcuMessageFormatBuilder';

export default component;
