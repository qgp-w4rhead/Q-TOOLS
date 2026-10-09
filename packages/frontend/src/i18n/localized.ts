/**
 * Localized registry helpers.
 *
 * Resolve tool/category display text through vue-i18n with English fallback.
 * The registry (`src/data/tools.ts`, `@q-tools/shared` categories) stays the
 * English source of truth; locale files override via `tools.<slug>.*` and
 * `categories.<id>.*` keys.
 *
 * These helpers call `i18n.global.t`/`te`/`tm`, so they are safe to use in
 * plain functions (composables, search scoring) as well as templates and
 * computeds - reads track the active locale reactively.
 */
import { i18n } from './index';
import type { CategoryDefinition, ToolMetadata } from '@/data/tools';

/** Localized category label, falling back to the registry label. */
export function categoryLabel(cat: CategoryDefinition): string {
  const key = `categories.${cat.id}.label`;
  return i18n.global.te(key) ? i18n.global.t(key) : cat.label;
}

/** Localized category description, falling back to the registry text. */
export function categoryDescription(cat: CategoryDefinition): string {
  const key = `categories.${cat.id}.description`;
  return i18n.global.te(key) ? i18n.global.t(key) : cat.description;
}

/** Localized tool name, falling back to the registry (English) name. */
export function localizedToolName(tool: ToolMetadata): string {
  const key = `tools.${tool.slug}.name`;
  return i18n.global.te(key) ? i18n.global.t(key) : tool.name;
}

/** Localized tool description, falling back to the registry text. */
export function localizedToolDescription(tool: ToolMetadata): string {
  const key = `tools.${tool.slug}.description`;
  return i18n.global.te(key) ? i18n.global.t(key) : tool.description;
}

/**
 * Localized tool keywords (`tools.<slug>.keywords` array), falling back to
 * the registry's English keywords. Returns a fresh array.
 */
export function localizedToolKeywords(tool: ToolMetadata): string[] {
  const key = `tools.${tool.slug}.keywords`;
  if (i18n.global.te(key)) {
    const value = i18n.global.tm(key);
    if (Array.isArray(value)) return value.map(String);
  }
  return [...tool.keywords];
}
