<script setup lang="ts">
/**
 * DockerRunToCompose - convert `docker run` commands into a
 * `docker-compose.yml` file.
 *
 * Paste one or more `docker run` invocations (optionally joined by `&&`,
 * `;`, `|`, or newlines, and with shell-style quoting / line
 * continuations). The tool parses image, ports, volumes, env, env-file,
 * networks, restart, name, hostname, labels, user, workdir, entrypoint and
 * command, then emits a canonical docker-compose.yml. Unsupported flags are
 * listed as warnings so nothing is silently dropped.
 *
 * Works in embed mode: receives `input` PostMessages to pre-fill the
 * command and sends `output` PostMessages whenever the converted YAML
 * changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertCircle, RefreshCw, Container, TriangleAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDockerRunToCompose } from './useDockerRunToCompose';

const { input, outputs, error, recompute } = useDockerRunToCompose();

const { t } = useI18n();
const U = 'tools.docker-run-to-compose.ui.';

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [
    t(o.serviceCount === 1 ? U + 'servicesOne' : U + 'services', { n: o.serviceCount }),
    t(U + 'metaBytes', { n: o.outputBytes }),
  ];
  if (o.warnings.length > 0) {
    parts.push(t(o.warnings.length === 1 ? U + 'warningsOne' : U + 'warnings', { n: o.warnings.length }));
  }
  return parts.join(' · ');
});

function onTextInput(e: Event): void {
  input.value = (e.target as HTMLTextAreaElement).value;
}

/** A small example to seed the input on first click. */
const EXAMPLE = `docker run -d \\
  --name web \\
  -p 80:80 \\
  -p 443:443 \\
  -v ./html:/usr/share/nginx/html:ro \\
  -e NGINX_HOST=example.com \\
  -e NGINX_PORT=80 \\
  --network frontend \\
  --restart unless-stopped \\
  nginx:alpine \\
  nginx -g "daemon off;"`;

function loadExample(): void {
  input.value = EXAMPLE;
  recompute();
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <button class="qt-btn qt-btn--outline" type="button" @click="loadExample">
          {{ t(U + 'example') }}
        </button>
        <button
          class="qt-btn qt-btn--primary"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>{{ t(U + 'convert') }}</span>
        </button>
      </template>

      <label class="qt-field">
        <span class="qt-label">{{ t(U + 'command') }}</span>
        <textarea
          class="qt-input qt-input--mono drc__textarea"
          :placeholder="t(U + 'phCommand')"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="outputs ? metaLine : t(U + 'descEmpty')"
      :copy-text="outputs?.yaml ?? ''"
      :copy-label="t(U + 'copyYaml')"
    >
      <p v-if="error" class="qt-alert qt-alert--error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="qt-alert qt-alert--empty">
          {{ t(U + 'descEmpty') }}
        </p>
        <div v-if="outputs" class="qt-panel qt-stack" style="--qt-stack-gap:6px;padding:8px 10px">
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <span class="qt-label" style="color:var(--qt-text);flex:1">
              <Container :size="13" />
              <span>{{ t(outputs.serviceCount === 1 ? U + 'servicesOne' : U + 'services', { n: outputs.serviceCount }) }}</span>
            </span>
            <CopyButton :text="outputs.yaml" :label="t('common.copy')" icon-only />
          </div>
          <pre v-if="outputs.yaml" class="drc__code"><code>{{ outputs.yaml }}</code></pre>
          <p v-else class="qt-alert qt-alert--empty">{{ t(U + 'emptyResult') }}</p>
          <div v-if="outputs.warnings.length > 0" class="drc__warnings">
            <div class="drc__warnings-head">
              <TriangleAlert :size="13" />
              <span>{{ t(outputs.warnings.length === 1 ? U + 'warningsOne' : U + 'warnings', { n: outputs.warnings.length }) }}</span>
            </div>
            <ul class="drc__warnings-list">
              <li v-for="(w, idx) in outputs.warnings" :key="idx">{{ w }}</li>
            </ul>
          </div>
          <div class="qt-row qt-row--center" style="--qt-row-gap:6px;font-size:12px;color:var(--qt-muted)">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Command textarea — taller min-height (collapses on narrow). */
.drc__textarea {
  min-height: 180px;
}

/* Compose output — bare code inside the result panel (no border/padding). */
.drc__code {
  font-family: var(--qt-font-mono);
  font-size: 13.5px;
  color: var(--qt-text);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  tab-size: 2;
}
.drc__code code {
  font: inherit;
  white-space: pre-wrap;
}

/* Unsupported-flag warnings — tinted callout with a mono list. */
.drc__warnings {
  margin-top: 4px;
  padding: 8px 10px;
  background: oklch(from var(--qt-warning, #b58a00) 90% c h / 0.1);
  border: 1px solid oklch(from var(--qt-warning, #b58a00) 60% c h / 0.4);
  border-radius: var(--qt-radius-sm);
}
.drc__warnings-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--qt-warning, #b58a00);
}
.drc__warnings-list {
  margin: 6px 0 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  color: var(--qt-text);
  line-height: 1.5;
}
.drc__warnings-list li {
  font-family: var(--qt-font-mono);
  word-break: break-word;
}

@media (max-width: 520px) {
  .drc__textarea {
    min-height: 140px;
  }
}
</style>
