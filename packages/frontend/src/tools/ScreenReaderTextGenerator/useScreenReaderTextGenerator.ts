/**
 * useScreenReaderTextGenerator - composable + pure logic for the screen
 * reader text generator.
 *
 * Generates visually-hidden (sr-only) text and aria-live region markup
 * for screen reader announcements.
 *
 * Pure helpers (`buildSrOnlyCss`, `buildSrOnlyHtml`, `buildAriaLiveHtml`,
 * `buildAriaLiveRegion`) have no Vue dependency. The composable wraps
 * them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export type OutputType = 'sr-only' | 'aria-live';
export type AriaLivePoliteness = 'off' | 'polite' | 'assertive';

export interface SrConfig {
  type: OutputType;
  text: string;
  politeness: AriaLivePoliteness;
  atomic: boolean;
  relevant: string;
}

export interface UseScreenReaderTextGeneratorReturn {
  config: Ref<SrConfig>;
  cssCode: Ref<string>;
  htmlCode: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** Build the sr-only CSS class definition. */
export function buildSrOnlyCss(): string {
  return [
    '.sr-only {',
    '  position: absolute;',
    '  width: 1px;',
    '  height: 1px;',
  '  padding: 0;',
  '  margin: -1px;',
  '  overflow: hidden;',
  '  clip: rect(0, 0, 0, 0);',
  '  white-space: nowrap;',
  '  border: 0;',
  '}',
  '',
  '/* Show when focused (for keyboard users) */',
  '.sr-only:focus {',
  '  position: static;',
  '  width: auto;',
  '  height: auto;',
  '  padding: inherit;',
  '  margin: inherit;',
  '  overflow: visible;',
  '  clip: auto;',
  '  white-space: inherit;',
  '}',
  ].join('\n');
}

/** Build the sr-only HTML snippet. */
export function buildSrOnlyHtml(text: string): string {
  if (!text) return '';
  return `<span class="sr-only">${text}</span>`;
}

/** Build the aria-live HTML snippet. */
export function buildAriaLiveHtml(cfg: SrConfig): string {
  if (!cfg.text) return '';
  const attrs: string[] = [
    `aria-live="${cfg.politeness}"`,
  ];
  if (cfg.atomic) attrs.push('aria-atomic="true"');
  if (cfg.relevant) attrs.push(`aria-relevant="${cfg.relevant}"`);
  return `<div ${attrs.join(' ')}>${cfg.text}</div>`;
}

/** Build the full aria-live region with CSS. */
export function buildAriaLiveRegion(cfg: SrConfig): string {
  const html = buildAriaLiveHtml(cfg);
  const css = `.aria-live-region {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n}\n\n<div class="aria-live-region" ${html.match(/aria-live="[^"]*"/)?.[0] ?? ''} ${html.match(/aria-atomic="[^"]*"/)?.[0] ?? ''} ${html.match(/aria-relevant="[^"]*"/)?.[0] ?? ''}>${cfg.text}</div>`;
  return css;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useScreenReaderTextGenerator(): UseScreenReaderTextGeneratorReturn {
  const config = ref<SrConfig>({
    type: 'sr-only',
    text: '',
    politeness: 'polite',
    atomic: false,
    relevant: 'additions text',
  });

  const cssCode = ref<string>('');
  const htmlCode = ref<string>('');

  function recompute(): void {
    if (config.value.type === 'sr-only') {
      cssCode.value = buildSrOnlyCss();
      htmlCode.value = buildSrOnlyHtml(config.value.text);
    } else {
      cssCode.value = '.aria-live-region {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n}';
      htmlCode.value = buildAriaLiveHtml(config.value);
    }
  }

  watch(config, () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') config.value.text = p.text;
      if (typeof p.type === 'string') config.value.type = p.type as OutputType;
      if (typeof p.politeness === 'string') config.value.politeness = p.politeness as AriaLivePoliteness;
      if (typeof p.atomic === 'boolean') config.value.atomic = p.atomic;
      if (typeof p.relevant === 'string') config.value.relevant = p.relevant;
    },
    output: [cssCode, htmlCode],
    toOutput: () => ({ css: cssCode.value, html: htmlCode.value, type: config.value.type }),
  });

  return {
    config,
    cssCode,
    htmlCode,
    isEmbed,
    embedInput,
  };
}
