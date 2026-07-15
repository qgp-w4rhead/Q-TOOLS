<script setup lang="ts">
/**
 * Root component.
 *
 * Wraps the app in Ionic's `<ion-app>` and renders the router outlet. The
 * `?embed=1` query alias is handled per-route (ToolLayout renders chromeless
 * when present); the dedicated `/embed/tools/:slug` route uses EmbedView.
 *
 * The OfflineBanner is mounted at the root so it is visible in both the full
 * app and embed views — tools still work offline, and the banner informs the
 * user that backend features are paused.
 */
import OfflineBanner from '@/components/OfflineBanner.vue';
</script>

<template>
  <ion-app>
    <OfflineBanner />
    <ion-router-outlet />
  </ion-app>
</template>
