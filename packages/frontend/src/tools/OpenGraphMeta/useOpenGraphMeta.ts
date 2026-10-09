/**
 * useOpenGraphMeta - composable + pure logic for the Open Graph / Twitter
 * social meta-tag generator tool.
 *
 * Builds a block of HTML `<meta>` tags for both the Open Graph protocol
 * (`og:*`) and Twitter Cards (`twitter:*`) from a small set of inputs
 * (title, description, image URL, canonical URL, site name, OG type, Twitter
 * card type, plus optional `twitter:site` / `twitter:creator` handles).
 *
 * Pure helpers (`escapeHtmlAttr`, `buildOpenGraphTags`, `buildTwitterTags`,
 * `buildMetaHtml`, `generateMetaHtml`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useOpenGraphMeta()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies - only string manipulation. Attribute values are
 * HTML-attribute-escaped (quotes, ampersands, angle brackets) so the generated
 * markup is safe to paste into any HTML document.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types & constants - no Vue dependency below this point                       */
/* -------------------------------------------------------------------------- */

/** Supported Open Graph `og:type` values (a curated subset of the OG protocol). */
export const OG_TYPES = [
  'website',
  'article',
  'profile',
  'book',
  'music.song',
  'music.album',
  'music.playlist',
  'video.movie',
  'video.episode',
  'video.tv_show',
  'video.other',
  'product',
] as const;
export type OgType = (typeof OG_TYPES)[number];

/** Supported Twitter card types. */
export const TWITTER_CARD_TYPES = [
  'summary',
  'summary_large_image',
  'player',
  'app',
] as const;
export type TwitterCardType = (typeof TWITTER_CARD_TYPES)[number];

/** Input shape for the meta-tag generator. */
export interface OpenGraphInput {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  siteName: string;
  type: OgType;
  twitterCard: TwitterCardType;
  /** Optional Twitter handle of the site, e.g. `@qtools`. */
  twitterSite: string;
  /** Optional Twitter handle of the author/creator, e.g. `@dev`. */
  twitterCreator: string;
}

/** A single `<meta>` tag represented as a property → value pair. */
export interface MetaTag {
  /** The `property` (Open Graph) or `name` (Twitter) attribute value. */
  key: string;
  /** The `content` attribute value. */
  content: string;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Escape a string for safe use as an HTML attribute value.
 *
 * Replaces `&`, `"`, `<`, `>` with their named entity equivalents. Newlines and
 * tabs are collapsed to spaces so the generated markup stays on a single
 * attribute value (meta-tag content attributes are single-line by convention
 * and multiline values render awkwardly when pasted into HTML).
 */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n\t]+/g, ' ');
}

/**
 * Build the Open Graph (`og:*`) meta tags from the input.
 *
 * Only emits tags whose content is non-empty (after trimming). The `og:type`
 * tag is emitted only when the type is not the default `website` - actually we
 * always emit `og:type` when present because consumers expect it; the default
 * `website` is a meaningful value. Empty optional fields (site name) are
 * omitted.
 */
export function buildOpenGraphTags(input: OpenGraphInput): MetaTag[] {
  const tags: MetaTag[] = [];
  const push = (key: string, content: string): void => {
    const trimmed = content.trim();
    if (trimmed.length > 0) tags.push({ key, content: trimmed });
  };

  push('og:title', input.title);
  push('og:description', input.description);
  push('og:image', input.imageUrl);
  push('og:image:alt', input.title); // reuse title as image alt when present
  push('og:url', input.url);
  push('og:site_name', input.siteName);
  push('og:type', input.type);

  return tags;
}

/**
 * Build the Twitter Card (`twitter:*`) meta tags from the input.
 *
 * The `twitter:card` tag is always emitted (it is required for Twitter Cards
 * to render at all). Other tags are emitted only when their content is
 * non-empty. `twitter:image` mirrors `og:image`; `twitter:title` /
 * `twitter:description` mirror their OG counterparts (Twitter falls back to OG
 * when these are absent, but emitting them explicitly is the conventional,
 * robust choice).
 */
export function buildTwitterTags(input: OpenGraphInput): MetaTag[] {
  const tags: MetaTag[] = [];
  const push = (key: string, content: string): void => {
    const trimmed = content.trim();
    if (trimmed.length > 0) tags.push({ key, content: trimmed });
  };

  // twitter:card is always required - emit even if other fields are empty.
  tags.push({ key: 'twitter:card', content: input.twitterCard });
  push('twitter:title', input.title);
  push('twitter:description', input.description);
  push('twitter:image', input.imageUrl);
  push('twitter:url', input.url);
  push('twitter:site', input.twitterSite);
  push('twitter:creator', input.twitterCreator);

  return tags;
}

/**
 * Render a single `<meta>` tag as an HTML string.
 *
 * Open Graph keys start with `og:` and use the `property` attribute; Twitter
 * keys start with `twitter:` and use the `name` attribute. (Both attributes
 * are technically interchangeable for crawlers, but following the convention
 * keeps the output consistent with what major platforms expect.)
 */
export function buildMetaTagHtml(tag: MetaTag): string {
  const attr = tag.key.startsWith('og:') ? 'property' : 'name';
  return `<meta ${attr}="${escapeHtmlAttr(tag.key)}" content="${escapeHtmlAttr(
    tag.content,
  )}" />`;
}

/**
 * Render a list of `<meta>` tags as a single HTML block (one tag per line).
 */
export function buildMetaHtml(tags: MetaTag[]): string {
  return tags.map(buildMetaTagHtml).join('\n');
}

/**
 * Generate the full HTML meta-tag block (Open Graph + Twitter) for the given
 * input. Returns an empty string when there is nothing to emit (no inputs
 * filled in and twitter:card has no useful content beyond the default).
 */
export interface OpenGraphResult {
  /** Open Graph tags. */
  ogTags: MetaTag[];
  /** Twitter tags. */
  twitterTags: MetaTag[];
  /** Combined HTML block (OG first, then Twitter, blank line between). */
  html: string;
  /** Total tag count. */
  count: number;
}

export function generateMetaHtml(input: OpenGraphInput): OpenGraphResult {
  const ogTags = buildOpenGraphTags(input);
  const twitterTags = buildTwitterTags(input);
  const blocks: string[] = [];
  if (ogTags.length > 0) blocks.push(buildMetaHtml(ogTags));
  if (twitterTags.length > 0) blocks.push(buildMetaHtml(twitterTags));
  const html = blocks.join('\n\n');
  return {
    ogTags,
    twitterTags,
    html,
    count: ogTags.length + twitterTags.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseOpenGraphMetaReturn {
  title: Ref<string>;
  description: Ref<string>;
  imageUrl: Ref<string>;
  url: Ref<string>;
  siteName: Ref<string>;
  type: Ref<OgType>;
  twitterCard: Ref<TwitterCardType>;
  twitterSite: Ref<string>;
  twitterCreator: Ref<string>;
  result: Ref<OpenGraphResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useOpenGraphMeta(): UseOpenGraphMetaReturn {
  const title = ref<string>('');
  const description = ref<string>('');
  const imageUrl = ref<string>('');
  const url = ref<string>('');
  const siteName = ref<string>('');
  const type = ref<OgType>('website');
  const twitterCard = ref<TwitterCardType>('summary_large_image');
  const twitterSite = ref<string>('');
  const twitterCreator = ref<string>('');

  const result = ref<OpenGraphResult>(
    generateMetaHtml({
      title: '',
      description: '',
      imageUrl: '',
      url: '',
      siteName: '',
      type: 'website',
      twitterCard: 'summary_large_image',
      twitterSite: '',
      twitterCreator: '',
    }),
  );

  function recompute(): void {
    result.value = generateMetaHtml({
      title: title.value,
      description: description.value,
      imageUrl: imageUrl.value,
      url: url.value,
      siteName: siteName.value,
      type: type.value,
      twitterCard: twitterCard.value,
      twitterSite: twitterSite.value,
      twitterCreator: twitterCreator.value,
    });
  }

  watch(
    [
      title,
      description,
      imageUrl,
      url,
      siteName,
      type,
      twitterCard,
      twitterSite,
      twitterCreator,
    ],
    recompute,
    { immediate: true, deep: true },
  );

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.title === 'string') title.value = p.title;
      if (typeof p.description === 'string') description.value = p.description;
      if (typeof p.imageUrl === 'string') imageUrl.value = p.imageUrl;
      if (typeof p.url === 'string') url.value = p.url;
      if (typeof p.siteName === 'string') siteName.value = p.siteName;
      if (typeof p.type === 'string' && OG_TYPES.includes(p.type as OgType)) {
        type.value = p.type as OgType;
      }
      if (
        typeof p.twitterCard === 'string' &&
        TWITTER_CARD_TYPES.includes(p.twitterCard as TwitterCardType)
      ) {
        twitterCard.value = p.twitterCard as TwitterCardType;
      }
      if (typeof p.twitterSite === 'string') twitterSite.value = p.twitterSite;
      if (typeof p.twitterCreator === 'string') {
        twitterCreator.value = p.twitterCreator;
      }
    },
  });

  watch(result, (r) => {
    if (isEmbed.value) {
      sendOutput({ html: r.html, count: r.count });
    }
  });

  return {
    title,
    description,
    imageUrl,
    url,
    siteName,
    type,
    twitterCard,
    twitterSite,
    twitterCreator,
    result,
    isEmbed,
    embedInput,
  };
}
