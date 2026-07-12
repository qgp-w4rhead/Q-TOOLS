<script setup lang="ts">
/**
 * Root component.
 *
 * Wraps the app in Ionic's `<ion-app>` and renders the router outlet. The
 * `?embed=1` query alias is handled per-route (ToolLayout renders chromeless
 * when present); the dedicated `/embed/tools/:slug` route uses EmbedView.
 */
</script>

<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>
