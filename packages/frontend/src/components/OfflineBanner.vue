<script setup lang="ts">
/**
 * OfflineBanner — fixed top banner shown when the browser is offline.
 *
 * Uses the singleton `useOnlineStatus` composable. The banner is dismissible
 * per offline episode: clicking the close button hides it until connectivity
 * is restored and then lost again. Auto-hides on reconnect.
 *
 * Rendered in App.vue so it is visible in both the full app and embed views
 * (tools still work offline; the banner just informs the user).
 */
import { ref, watch, computed } from 'vue';
import { WifiOff, X } from 'lucide-vue-next';
import { useOnlineStatus, shouldShowOfflineBanner } from '@/composables/useOnlineStatus';

const { isOnline } = useOnlineStatus();

// Per-episode dismissal. Reset to `false` whenever we come back online so the
// banner reappears on the next offline transition.
const dismissed = ref(false);

watch(
  () => isOnline.value,
  (online) => {
    if (online) dismissed.value = false;
  },
);

const visible = computed(() =>
  shouldShowOfflineBanner(isOnline.value, dismissed.value),
);

function close(): void {
  dismissed.value = true;
}
</script>

<template>
  <Transition name="offline-banner">
    <div v-if="visible" class="offline-banner" role="status" aria-live="polite">
      <WifiOff :size="16" class="offline-banner__icon" />
      <span class="offline-banner__text">
        You&rsquo;re offline — tools still work, but backend features (sync, auth) are paused.
      </span>
      <button
        class="offline-banner__close"
        type="button"
        aria-label="Dismiss offline banner"
        @click="close"
      >
        <X :size="16" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: var(--qt-warning, #d29922);
  color: #1f2328;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.offline-banner__icon {
  flex-shrink: 0;
}
.offline-banner__text {
  flex: 1;
  line-height: 1.3;
}
.offline-banner__close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.offline-banner__close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.12);
}

.offline-banner-enter-active,
.offline-banner-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.offline-banner-enter-from,
.offline-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
