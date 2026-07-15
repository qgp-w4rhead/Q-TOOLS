/**
 * Pure-logic helpers for the embed.js loader.
 *
 * `packages/frontend/public/embed.js` is a standalone browser script (no
 * module imports) served as a static asset. It contains inline copies of the
 * helpers below. This module mirrors those helpers as typed, importable
 * functions so they can be unit-tested with tsx (Node) without a DOM.
 *
 * Keep the two implementations in sync — the tests here validate the logic
 * that ships in embed.js.
 */

/**
 * Built-in map of tools that declare `iframeRequirements` in their tool
 * metadata. When the consumer does not pass an explicit `allow` attribute,
 * embed.js uses this map to set the correct Permissions Policy on the iframe.
 *
 * Keys are tool slugs; values are the `allow` attribute string.
 */
export const TOOL_IFRAME_REQUIREMENTS: Record<string, string> = {
  'camera-recorder': 'camera; microphone',
  'html-wysiwyg-editor': 'clipboard-write',
};

/** Source tag for messages sent from the parent to the embedded tool. */
export const PARENT_SOURCE = 'Q-Tools-parent';
/** Source tag for messages sent from the embedded tool to the parent. */
export const EMBED_SOURCE = 'Q-Tools-embed';

/**
 * Resolve the iframe `allow` attribute for a tool slug. An explicit
 * consumer-provided value always wins; otherwise the built-in
 * `TOOL_IFRAME_REQUIREMENTS` map is consulted.
 *
 * @param slug  Tool slug.
 * @param explicit  Consumer-provided allow value (or undefined).
 * @returns The resolved allow attribute, or undefined when neither an
 *   explicit value nor a built-in requirement exists.
 */
export function resolveAllow(
  slug: string,
  explicit?: string,
): string | undefined {
  if (explicit) return explicit;
  if (Object.prototype.hasOwnProperty.call(TOOL_IFRAME_REQUIREMENTS, slug)) {
    return TOOL_IFRAME_REQUIREMENTS[slug];
  }
  return undefined;
}

/**
 * Is this a valid Q-Tools message from the embedded tool?
 *
 * Accepts `output` and `resize` message types with the `Q-Tools-embed`
 * source tag. Used by the parent-side message listener to filter noise.
 *
 * @param data  The `event.data` value from a MessageEvent.
 */
export function isToolMessage(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === 'object' &&
    (data as Record<string, unknown>).source === EMBED_SOURCE &&
    ((data as Record<string, unknown>).type === 'output' ||
      (data as Record<string, unknown>).type === 'resize')
  );
}

/**
 * Build the iframe `src` URL for a tool slug given a base URL.
 *
 * @param baseUrl  Q-Tools origin (no trailing slash).
 * @param slug  Tool slug.
 * @returns The full `/embed/tools/<slug>` URL.
 */
export function buildEmbedSrc(baseUrl: string, slug: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/embed/tools/${encodeURIComponent(slug)}`;
}

/**
 * Resolve the embed origin (scheme + host + port) from a base URL string.
 * Falls back to the provided `fallbackOrigin` when the base URL is empty or
 * malformed.
 *
 * @param baseUrl  Q-Tools base URL.
 * @param fallbackOrigin  Fallback origin (e.g. `window.location.origin`).
 */
export function resolveEmbedOrigin(
  baseUrl: string,
  fallbackOrigin: string,
): string {
  if (baseUrl && baseUrl.indexOf('://') !== -1) {
    try {
      return new URL(baseUrl).origin;
    } catch {
      /* ignore malformed */
    }
  }
  return fallbackOrigin;
}
