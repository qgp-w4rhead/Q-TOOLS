/**
 * useAltTextBuilder - composable + pure logic for the alt text builder.
 *
 * Template-based alt text generator for images. Combines subject, action,
 * and context into a descriptive alt text string following WCAG guidelines.
 *
 * Pure helpers (`buildAltText`, `buildAltAttribute`) have no Vue dependency.
 * The `useAltTextBuilder()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                     */
/* -------------------------------------------------------------------------- */

export interface AltTextConfig {
  subject: string;
  action: string;
  context: string;
  emotion: string;
  format: 'sentence' | 'descriptive' | 'minimal';
  includeContext: boolean;
}

export interface UseAltTextBuilderReturn {
  config: Ref<AltTextConfig>;
  altText: Ref<string>;
  altAttribute: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Build alt text from the config fields. */
export function buildAltText(cfg: AltTextConfig): string {
  const parts: string[] = [];

  if (cfg.format === 'minimal') {
    return cfg.subject || '';
  }

  if (cfg.subject) parts.push(cfg.subject);
  if (cfg.action) parts.push(cfg.action);
  if (cfg.emotion) parts.push(cfg.emotion);
  if (cfg.includeContext && cfg.context) parts.push(cfg.context);

  if (parts.length === 0) return '';

  if (cfg.format === 'descriptive') {
    return parts.join(', ') + '.';
  }

  // sentence format
  let text = parts.join(' ');
  // Ensure it ends with a period
  if (!text.endsWith('.')) text += '.';
  // Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text;
}

/** Build the full HTML alt attribute. */
export function buildAltAttribute(cfg: AltTextConfig): string {
  const text = buildAltText(cfg);
  if (!text) return '';
  const escaped = text.replace(/"/g, '\\"');
  return `alt="${escaped}"`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export function useAltTextBuilder(): UseAltTextBuilderReturn {
  const config = ref<AltTextConfig>({
    subject: '',
    action: '',
    context: '',
    emotion: '',
    format: 'sentence',
    includeContext: true,
  });

  const altText = ref<string>('');
  const altAttribute = ref<string>('');

  function recompute(): void {
    altText.value = buildAltText(config.value);
    altAttribute.value = buildAltAttribute(config.value);
  }

  watch(config, () => recompute(), { deep: true });
  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.subject === 'string') config.value.subject = p.subject;
      if (typeof p.action === 'string') config.value.action = p.action;
      if (typeof p.context === 'string') config.value.context = p.context;
      if (typeof p.emotion === 'string') config.value.emotion = p.emotion;
      if (typeof p.format === 'string') config.value.format = p.format as AltTextConfig['format'];
      if (typeof p.includeContext === 'boolean') config.value.includeContext = p.includeContext;
    },
    output: [altText, altAttribute],
    toOutput: () => ({ altText: altText.value, altAttribute: altAttribute.value }),
  });

  return {
    config,
    altText,
    altAttribute,
    isEmbed,
    embedInput,
  };
}
