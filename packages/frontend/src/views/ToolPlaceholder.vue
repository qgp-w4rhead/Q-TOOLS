<script setup lang="ts">
/**
 * Placeholder shown for tools that have not yet been implemented.
 *
 * Displays the tool's metadata and a clear "coming soon" state so the
 * scaffold routes are navigable from M0 onward. Replaced by the real tool
 * component (lazy-loaded) in M1+.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Hammer } from 'lucide-vue-next';
import { getToolBySlug, getCategoryById } from '@/data/tools';
import { categoryLabel, localizedToolDescription, localizedToolName } from '@/i18n/localized';

const { t } = useI18n();
const props = defineProps<{ slug?: string }>();

const tool = computed(() => (props.slug ? getToolBySlug(props.slug) : undefined));
const category = computed(() =>
  tool.value ? getCategoryById(tool.value.category) : undefined,
);
</script>

<template>
  <section class="placeholder qt-card">
    <div class="placeholder__icon">
      <Hammer :size="28" />
    </div>
    <h2 class="placeholder__title">
      {{ tool ? localizedToolName(tool) : t('tool.fallbackTitle') }}
    </h2>
    <p class="placeholder__desc">
      {{ tool ? localizedToolDescription(tool) : t('tool.notImplemented') }}
    </p>
    <p v-if="category" class="placeholder__category">
      {{ t('tool.category') }} <strong>{{ categoryLabel(category) }}</strong>
    </p>
    <p class="placeholder__status">{{ t('tool.comingSoon') }}</p>
  </section>
</template>

<style scoped>
.placeholder {
  max-width: 560px;
  margin: 40px auto;
  text-align: center;
}
.placeholder__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--qt-radius);
  background: oklch(from var(--qt-accent) 90% c h);
  color: var(--qt-bg);
  margin-bottom: 16px;
}
.placeholder__title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--qt-text);
}
.placeholder__desc {
  margin: 0 0 8px;
  color: var(--qt-muted);
}
.placeholder__category {
  margin: 0 0 16px;
  color: var(--qt-muted);
  font-size: 13px;
}
.placeholder__status {
  margin: 0;
  color: var(--qt-accent);
  font-size: 13px;
  font-weight: 600;
}
</style>
