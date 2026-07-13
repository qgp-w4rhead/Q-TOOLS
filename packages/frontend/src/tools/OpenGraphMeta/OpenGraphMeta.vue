<script setup lang="ts">
/**
 * OpenGraphMeta — generate Open Graph (`og:*`) and Twitter Card (`twitter:*`)
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
  <div class="og-meta">
    <ToolInput
      title="Page details"
      description="Fill in the fields to generate Open Graph and Twitter Card meta tags. Empty fields are omitted from the output."
    >
      <div class="og-meta__grid">
        <label class="og-meta__field og-meta__field--full">
          <span class="og-meta__label">
            <TypeIcon :size="13" />
            <span>Title</span>
          </span>
          <input
            class="og-meta__input"
            type="text"
            placeholder="My Awesome Page"
            :value="title"
            spellcheck="false"
            autocomplete="off"
            @input="title = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="og-meta__field og-meta__field--full">
          <span class="og-meta__label">
            <TypeIcon :size="13" />
            <span>Description</span>
          </span>
          <textarea
            class="og-meta__input og-meta__textarea"
            placeholder="A short summary that appears on social cards."
            :value="description"
            rows="3"
            spellcheck="false"
            @input="description = ($event.target as HTMLTextAreaElement).value"
          />
        </label>

        <label class="og-meta__field og-meta__field--full">
          <span class="og-meta__label">
            <ImageIcon :size="13" />
            <span>Image URL</span>
          </span>
          <input
            class="og-meta__input"
            type="url"
            placeholder="https://example.com/og-image.png"
            :value="imageUrl"
            spellcheck="false"
            autocomplete="off"
            @input="imageUrl = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="og-meta__field og-meta__field--full">
          <span class="og-meta__label">
            <LinkIcon :size="13" />
            <span>Canonical URL</span>
          </span>
          <input
            class="og-meta__input"
            type="url"
            placeholder="https://example.com/page"
            :value="url"
            spellcheck="false"
            autocomplete="off"
            @input="url = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="og-meta__field">
          <span class="og-meta__label">
            <Share2 :size="13" />
            <span>Site name</span>
          </span>
          <input
            class="og-meta__input"
            type="text"
            placeholder="My Site"
            :value="siteName"
            spellcheck="false"
            autocomplete="off"
            @input="siteName = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="og-meta__field">
          <span class="og-meta__label">
            <TypeIcon :size="13" />
            <span>Open Graph type</span>
          </span>
          <select
            class="og-meta__input og-meta__select"
            :value="type"
            @change="onType"
          >
            <option v-for="t in _OG_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="og-meta__field">
          <span class="og-meta__label">
            <Share2 :size="13" />
            <span>Twitter card type</span>
          </span>
          <select
            class="og-meta__input og-meta__select"
            :value="twitterCard"
            @change="onTwitterCard"
          >
            <option v-for="t in _TWITTER_CARD_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="og-meta__field">
          <span class="og-meta__label">
            <Share2 :size="13" />
            <span>Twitter site handle (optional)</span>
          </span>
          <input
            class="og-meta__input"
            type="text"
            placeholder="@qtools"
            :value="twitterSite"
            spellcheck="false"
            autocomplete="off"
            @input="twitterSite = ($event.target as HTMLInputElement).value"
          />
        </label>

        <label class="og-meta__field">
          <span class="og-meta__label">
            <Share2 :size="13" />
            <span>Twitter creator handle (optional)</span>
          </span>
          <input
            class="og-meta__input"
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
      title="Meta tags"
      :description="result.html.length > 0 ? `${result.count} tag${result.count === 1 ? '' : 's'} — paste into the <head> of your page.` : 'Fill in any field above to generate meta tags.'"
      :copy-text="result.html"
      copy-label="Copy HTML"
    >
      <template v-if="!hasAnyInput && result.html.length === 0">
        <p class="og-meta__empty">
          Fill in any field above to generate meta tags.
        </p>
      </template>
      <template v-else>
        <pre class="og-meta__code"><code>{{ result.html }}</code></pre>
        <div class="og-meta__sections">
          <div class="og-meta__section">
            <span class="og-meta__section-label">Open Graph</span>
            <span class="og-meta__section-count">{{ result.ogTags.length }}</span>
          </div>
          <div class="og-meta__section">
            <span class="og-meta__section-label">Twitter</span>
            <span class="og-meta__section-count">{{ result.twitterTags.length }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.og-meta {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.og-meta__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.og-meta__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.og-meta__field--full {
  grid-column: 1 / -1;
}
.og-meta__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.og-meta__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.og-meta__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.og-meta__textarea {
  resize: vertical;
  min-height: 64px;
  font-family: inherit;
}
.og-meta__select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}
.og-meta__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.og-meta__code {
  margin: 0;
  padding: 12px 14px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
  max-height: 360px;
  overflow-y: auto;
}
.og-meta__code code {
  font-family: inherit;
}
.og-meta__sections {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
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
.og-meta__section-label {
  font-weight: 600;
  color: var(--qt-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.og-meta__section-count {
  font-variant-numeric: tabular-nums;
  color: var(--qt-accent);
  font-weight: 700;
}
@media (max-width: 640px) {
  .og-meta__grid {
    grid-template-columns: 1fr;
  }
}
</style>
