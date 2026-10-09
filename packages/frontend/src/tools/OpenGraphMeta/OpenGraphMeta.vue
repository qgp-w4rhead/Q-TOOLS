<script setup lang="ts">
/**
 * OpenGraphMeta - generate Open Graph (`og:*`) and Twitter Card (`twitter:*`)
 * social meta tags from a small form.
 *
 * Inputs: title, description, image URL, canonical URL, site name, OG type,
 * Twitter card type, plus optional `twitter:site` / `twitter:creator` handles.
 * Output: a block of HTML `<meta>` tags ready to paste into the `<head>` of a
 * page. Attribute values are HTML-escaped so the markup is safe to paste into
 * any HTML document.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill any field;
 * sends `output` PostMessages with `{ html, count }` whenever the result
 * changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Share2, Image as ImageIcon, Link as LinkIcon, Type as TypeIcon } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import {
  useOpenGraphMeta,
  OG_TYPES,
  TWITTER_CARD_TYPES,
  type OgType,
  type TwitterCardType,
} from './useOpenGraphMeta';

const {
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
} = useOpenGraphMeta();

const { t } = useI18n();
const U = 'tools.open-graph-meta-generator.ui.';

const hasAnyInput = computed(
  () =>
    title.value.length > 0 ||
    description.value.length > 0 ||
    imageUrl.value.length > 0 ||
    url.value.length > 0 ||
    siteName.value.length > 0 ||
    twitterSite.value.length > 0 ||
    twitterCreator.value.length > 0,
);

function onType(e: Event): void {
  const v = (e.target as HTMLSelectElement).value as OgType;
  type.value = v;
}
function onTwitterCard(e: Event): void {
  const v = (e.target as HTMLSelectElement).value as TwitterCardType;
  twitterCard.value = v;
}

// Re-export for template usage.
const _OG_TYPES = OG_TYPES;
const _TWITTER_CARD_TYPES = TWITTER_CARD_TYPES;
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-grid" style="--qt-grid-min:240px;--qt-grid-gap:14px">
        <label class="qt-field og-meta__field--full">
          <span class="qt-label">
            <TypeIcon :size="13" />
            <span>{{ t(U + 'fieldTitle') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            :placeholder="t(U + 'fieldTitlePlaceholder')"
            :value="title"
            spellcheck="false"
            autocomplete="off"
            @input="title = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field og-meta__field--full">
          <span class="qt-label">
            <TypeIcon :size="13" />
            <span>{{ t(U + 'fieldDescription') }}</span>
          </span>
          <textarea
            class="qt-input og-meta__textarea"
            :placeholder="t(U + 'fieldDescriptionPlaceholder')"
            :value="description"
            rows="3"
            spellcheck="false"
            @input="description = ($event.target as HTMLTextAreaElement).value"
          />
        </label>

        <label class="qt-field og-meta__field--full">
          <span class="qt-label">
            <ImageIcon :size="13" />
            <span>{{ t(U + 'fieldImageUrl') }}</span>
          </span>
          <input
            class="qt-input"
            type="url"
            placeholder="https://example.com/og-image.png"
            :value="imageUrl"
            spellcheck="false"
            autocomplete="off"
            @input="imageUrl = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field og-meta__field--full">
          <span class="qt-label">
            <LinkIcon :size="13" />
            <span>{{ t(U + 'fieldCanonicalUrl') }}</span>
          </span>
          <input
            class="qt-input"
            type="url"
            placeholder="https://example.com/page"
            :value="url"
            spellcheck="false"
            autocomplete="off"
            @input="url = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Share2 :size="13" />
            <span>{{ t(U + 'fieldSiteName') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            :placeholder="t(U + 'fieldSiteNamePlaceholder')"
            :value="siteName"
            spellcheck="false"
            autocomplete="off"
            @input="siteName = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <TypeIcon :size="13" />
            <span>{{ t(U + 'fieldOgType') }}</span>
          </span>
          <select
            class="qt-input"
            :value="type"
            @change="onType"
          >
            <option v-for="t in _OG_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Share2 :size="13" />
            <span>{{ t(U + 'fieldTwitterCard') }}</span>
          </span>
          <select
            class="qt-input"
            :value="twitterCard"
            @change="onTwitterCard"
          >
            <option v-for="t in _TWITTER_CARD_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Share2 :size="13" />
            <span>{{ t(U + 'fieldTwitterSite') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            placeholder="@qtools"
            :value="twitterSite"
            spellcheck="false"
            autocomplete="off"
            @input="twitterSite = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="qt-field">
          <span class="qt-label">
            <Share2 :size="13" />
            <span>{{ t(U + 'fieldTwitterCreator') }}</span>
          </span>
          <input
            class="qt-input"
            type="text"
            placeholder="@dev"
            :value="twitterCreator"
            spellcheck="false"
            autocomplete="off"
            @input="twitterCreator = ($event.target as HTMLInputElement).value"
          />
        </label>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outputTitle')"
      :description="result.html.length > 0 ? t(U + 'outputDesc', result.count) : t(U + 'outputDescEmpty')"
      :copy-text="result.html"
      :copy-label="t(U + 'copyHtml')"
    >
      <template v-if="!hasAnyInput && result.html.length === 0">
        <p class="qt-alert qt-alert--empty">
          {{ t(U + 'empty') }}
        </p>
      </template>
      <template v-else>
        <pre class="qt-output og-meta__code"><code>{{ result.html }}</code></pre>
        <div class="qt-row" style="--qt-row-gap:10px;margin-top:10px">
          <div class="og-meta__section">
            <span class="qt-stat-head">{{ t(U + 'sectionOg') }}</span>
            <span class="og-meta__section-count">{{ result.ogTags.length }}</span>
          </div>
          <div class="og-meta__section">
            <span class="qt-stat-head">{{ t(U + 'sectionTwitter') }}</span>
            <span class="og-meta__section-count">{{ result.twitterTags.length }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Full-width field spanning both grid columns (layout via .qt-field). */
.og-meta__field--full {
  grid-column: 1 / -1;
}
/* Description textarea floor (control via .qt-input). */
.og-meta__textarea {
  min-height: 64px;
}
/* Meta-tags markup block (base via .qt-output) — capped, scrollable, break-all. */
.og-meta__code {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-all;
  max-height: 360px;
  overflow: auto;
}
.og-meta__code code {
  font-family: inherit;
}
/* Tag-count pill — label + accent count. */
.og-meta__section {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: 999px;
  font-size: 12px;
}
.og-meta__section-count {
  font-variant-numeric: tabular-nums;
  color: var(--qt-accent);
  font-weight: 700;
}
</style>
