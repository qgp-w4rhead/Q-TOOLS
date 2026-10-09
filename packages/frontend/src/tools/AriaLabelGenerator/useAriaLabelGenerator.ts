/**
 * useAriaLabelGenerator - composable + pure logic for the ARIA label generator.
 *
 * Generates ARIA attributes (aria-label, aria-labelledby, aria-describedby,
 * role) from user-provided form inputs. Produces ready-to-paste HTML
 * snippets with proper ARIA wiring.
 *
 * Pure helpers (`generateAriaLabel`, `generateAriaLabelledby`,
 * `generateAriaDescribedby`, `generateRole`, `buildHtml`) have no Vue
 * dependency. The `useAriaLabelGenerator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export type ElementType =
  | 'button'
  | 'link'
  | 'input'
  | 'image'
  | 'heading'
  | 'list'
  | 'navigation'
  | 'dialog'
  | 'alert'
  | 'tab'
  | 'tablist'
  | 'tabpanel'
  | 'combobox'
  | 'option'
  | 'checkbox'
  | 'radio'
  | 'slider'
  | 'textbox'
  | 'searchbox'
  | 'menuitem'
  | 'menu'
  | 'banner'
  | 'contentinfo'
  | 'main'
  | 'complementary'
  | 'form'
  | 'region'
  | 'article'
  | 'group'
  | 'separator'
  | 'status'
  | 'timer'
  | 'alertdialog'
  | 'tooltip'
  | 'log'
  | 'marquee'
  | 'progressbar'
  | 'scrollbar'
  | 'spinbutton'
  | 'switch'
  | 'tree'
  | 'treeitem'
  | 'treegrid'
  | 'definition'
  | 'note'
  | 'figure'
  | 'paragraph'
  | 'row'
  | 'rowheader'
  | 'rowgroup'
  | 'cell'
  | 'columnheader'
  | 'grid'
  | 'gridcell'
  | 'table'
  | 'application'
  | 'directory'
  | 'document'
  | 'feed'
  | 'math'
  | 'presentation'
  | 'none'
  | 'img'
  | 'link2'
  | 'button2';

export interface AriaConfig {
  label: string;
  labelledbyId: string;
  describedbyId: string;
  description: string;
  role: string;
  elementTag: string;
  useLabel: boolean;
  useLabelledby: boolean;
  useDescribedby: boolean;
  useRole: boolean;
}

export interface UseAriaLabelGeneratorReturn {
  config: Ref<AriaConfig>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const ELEMENT_TAGS = [
  'button', 'a', 'input', 'img', 'div', 'span', 'nav', 'section',
  'header', 'footer', 'main', 'aside', 'article', 'ul', 'ol', 'li',
  'dialog', 'table', 'form', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
] as const;

export const ARIA_ROLES: Record<string, string> = {
  button: 'button',
  link: 'link',
  input: 'textbox',
  image: 'img',
  heading: 'heading',
  list: 'list',
  navigation: 'navigation',
  dialog: 'dialog',
  alert: 'alert',
  tab: 'tab',
  tablist: 'tablist',
  tabpanel: 'tabpanel',
  combobox: 'combobox',
  option: 'option',
  checkbox: 'checkbox',
  radio: 'radio',
  slider: 'slider',
  textbox: 'textbox',
  searchbox: 'searchbox',
  menuitem: 'menuitem',
  menu: 'menu',
  banner: 'banner',
  contentinfo: 'contentinfo',
  main: 'main',
  complementary: 'complementary',
  form: 'form',
  region: 'region',
  article: 'article',
  group: 'group',
  separator: 'separator',
  status: 'status',
  timer: 'timer',
  alertdialog: 'alertdialog',
  tooltip: 'tooltip',
  log: 'log',
  marquee: 'marquee',
  progressbar: 'progressbar',
  scrollbar: 'scrollbar',
  spinbutton: 'spinbutton',
  switch: 'switch',
  tree: 'tree',
  treeitem: 'treeitem',
  treegrid: 'treegrid',
  definition: 'definition',
  note: 'note',
  figure: 'figure',
  paragraph: 'paragraph',
  row: 'row',
  rowheader: 'rowheader',
  rowgroup: 'rowgroup',
  cell: 'cell',
  columnheader: 'columnheader',
  grid: 'grid',
  gridcell: 'gridcell',
  table: 'table',
  application: 'application',
  directory: 'directory',
  document: 'document',
  feed: 'feed',
  math: 'math',
  presentation: 'presentation',
  none: 'none',
  img: 'img',
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Escape HTML attribute value. */
const AMP = String.fromCharCode(38); // &
const AMP_ENTITY = AMP + 'amp;';
const QUOT_ENTITY = AMP + 'quot;';
const LT_ENTITY = AMP + 'lt;';
const GT_ENTITY = AMP + 'gt;';

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, AMP_ENTITY)
    .replace(/"/g, QUOT_ENTITY)
    .replace(/</g, LT_ENTITY)
    .replace(/>/g, GT_ENTITY);
}

/** Build the HTML output snippet from the ARIA config. */
export function buildHtml(cfg: AriaConfig): string {
  const attrs: string[] = [];

  if (cfg.useRole && cfg.role) {
    attrs.push(`role="${escapeAttr(cfg.role)}"`);
  }
  if (cfg.useLabel && cfg.label) {
    attrs.push(`aria-label="${escapeAttr(cfg.label)}"`);
  }
  if (cfg.useLabelledby && cfg.labelledbyId) {
    attrs.push(`aria-labelledby="${escapeAttr(cfg.labelledbyId)}"`);
  }
  if (cfg.useDescribedby && cfg.describedbyId) {
    attrs.push(`aria-describedby="${escapeAttr(cfg.describedbyId)}"`);
  }

  const tag = cfg.elementTag || 'div';
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  let html = `<${tag}${attrStr}></${tag}>`;

  if (cfg.useLabelledby && cfg.labelledbyId) {
    html += `\n<span id="${escapeAttr(cfg.labelledbyId)}">${escapeAttr(cfg.label || 'Label text')}</span>`;
  }
  if (cfg.useDescribedby && cfg.describedbyId) {
    html += `\n<span id="${escapeAttr(cfg.describedbyId)}">${escapeAttr(cfg.description || 'Description text')}</span>`;
  }

  return html;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export function useAriaLabelGenerator(): UseAriaLabelGeneratorReturn {
  const config = ref<AriaConfig>({
    label: '',
    labelledbyId: 'label-id',
    describedbyId: 'desc-id',
    description: '',
    role: 'button',
    elementTag: 'button',
    useLabel: true,
    useLabelledby: false,
    useDescribedby: false,
    useRole: false,
  });

  const output = ref<string>('');

  function recompute(): void {
    output.value = buildHtml(config.value);
  }

  watch(config, () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.label === 'string') config.value.label = p.label;
      if (typeof p.role === 'string') config.value.role = p.role;
      if (typeof p.elementTag === 'string') config.value.elementTag = p.elementTag;
      if (typeof p.description === 'string') config.value.description = p.description;
      if (typeof p.labelledbyId === 'string') config.value.labelledbyId = p.labelledbyId;
      if (typeof p.describedbyId === 'string') config.value.describedbyId = p.describedbyId;
    },
    output: output,
    toOutput: () => ({ html: output.value, config: { ...config.value } }),
  });

  return {
    config,
    output,
    isEmbed,
    embedInput,
  };
}
