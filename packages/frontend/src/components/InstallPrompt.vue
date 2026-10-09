<script setup lang="ts">
/**
 * InstallPrompt - install PWA affordance shown on the home page.
 *
 * Surfaces an "Install Q-Tools" card when the browser has fired
 * `beforeinstallprompt` (i.e. the app is installable) and the user has not
 * already dismissed it or installed the app. Clicking "Install" triggers the
 * native install prompt via the `usePwaInstall` composable.
 *
 * The dismissed flag is persisted to LocalStorage so the user is not nagged
 * across sessions. After a successful install the card disappears for good.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Download, X } from 'lucide-vue-next';
import { usePwaInstall } from '@/composables/usePwaInstall';

const { t } = useI18n();
const { shouldShowPrompt, promptInstall, dismiss } = usePwaInstall();

const installing = ref(false);

async function onInstall(): Promise<void> {
  if (installing.value) return;
  installing.value = true;
  try {
    await promptInstall();
  } finally {
    installing.value = false;
  }
}

function onDismiss(): void {
  dismiss();
}
</script>

<template>
  <Transition name="install-prompt">
    <div v-if="shouldShowPrompt" class="install-prompt" role="dialog" :aria-label="t('install.ariaLabel')">
      <div class="install-prompt__icon">
        <Download :size="20" />
      </div>
      <div class="install-prompt__body">
        <p class="install-prompt__title">{{ t('install.title') }}</p>
        <p class="install-prompt__subtitle">
          {{ t('install.subtitle') }}
        </p>
      </div>
      <div class="install-prompt__actions">
        <button
          class="install-prompt__install"
          type="button"
          :disabled="installing"
          @click="onInstall"
        >
          {{ installing ? t('common.installing') : t('common.install') }}
        </button>
        <button
          class="install-prompt__dismiss"
          type="button"
          :aria-label="t('install.dismiss')"
          @click="onDismiss"
        >
          <X :size="16" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.install-prompt {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 560px;
  margin: 0 auto 20px;
  padding: 14px 16px;
  background: var(--qt-surface);
  border: 1px solid var(--qt-border);
  border-radius: 1vw;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.install-prompt__icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--qt-radius-sm);
  background: oklch(from var(--qt-accent) 25% c h);
  color: var(--qt-accent);
}
.install-prompt__body {
  flex: 1;
  min-width: 0;
}
.install-prompt__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--qt-text);
}
.install-prompt__subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  color: var(--qt-muted);
  line-height: 1.35;
}
.install-prompt__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.install-prompt__install {
  padding: 8px 16px;
  border: none;
  border-radius: var(--qt-radius-sm);
  background: var(--qt-accent);
  color: var(--qt-bg);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.install-prompt__install:hover:not(:disabled) {
  transform: scale(1.03);
}
.install-prompt__install:disabled {
  opacity: 0.6;
  cursor: progress;
}
.install-prompt__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  background: transparent;
  color: var(--qt-muted);
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.install-prompt__dismiss:hover {
  color: var(--qt-text);
  border-color: var(--qt-accent-soft);
}

.install-prompt-enter-active,
.install-prompt-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease, border-radius 0.25s ease;
}
.install-prompt-enter-from,
.install-prompt-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  border-top-left-radius: 1vw;
  border-top-right-radius: 1vw;
}

@media (max-width: 560px) {
  .install-prompt {
    flex-wrap: wrap;
    max-width: 100%;
  }
  .install-prompt__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
