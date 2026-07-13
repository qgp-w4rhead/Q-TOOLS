<script setup lang="ts">
/**
 * DockerRunToCompose — convert `docker run` commands into a
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
import { AlertCircle, RefreshCw, Container, TriangleAlert } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { useDockerRunToCompose } from './useDockerRunToCompose';

const { input, outputs, error, recompute } = useDockerRunToCompose();

const metaLine = computed(() => {
  if (!outputs.value) return '';
  const o = outputs.value;
  const parts = [`${o.serviceCount} service${o.serviceCount === 1 ? '' : 's'}`, `${o.outputBytes} bytes`];
  if (o.warnings.length > 0) {
    parts.push(`${o.warnings.length} warning${o.warnings.length === 1 ? '' : 's'}`);
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
  <div class="drc">
    <ToolInput
      title="docker run command"
      description="Paste one or more `docker run` commands. Shell quoting and line continuations are supported."
    >
      <template #actions>
        <button class="drc__btn drc__btn--ghost" type="button" @click="loadExample">
          Example
        </button>
        <button
          class="drc__btn"
          type="button"
          :disabled="input.trim().length === 0"
          @click="recompute"
        >
          <RefreshCw :size="14" />
          <span>Convert</span>
        </button>
      </template>

      <label class="drc__field">
        <span class="drc__label">Command</span>
        <textarea
          class="drc__textarea drc__textarea--mono"
          placeholder="docker run -d --name web -p 80:80 -v ./html:/usr/share/nginx/html nginx:alpine"
          :value="input"
          rows="10"
          spellcheck="false"
          autocomplete="off"
          @input="onTextInput"
        />
      </label>
    </ToolInput>

    <ToolOutput
      title="docker-compose.yml"
      :description="outputs ? metaLine : 'Paste a docker run command above to convert.'"
      :copy-text="outputs?.yaml ?? ''"
      copy-label="Copy YAML"
    >
      <p v-if="error" class="drc__error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
      </p>
      <template v-else>
        <p v-if="!outputs" class="drc__empty">
          Paste a docker run command above to convert.
        </p>
        <div v-if="outputs" class="drc__result">
          <div class="drc__result-head">
            <span class="drc__result-label">
              <Container :size="13" />
              <span>{{ outputs.serviceCount }} service{{ outputs.serviceCount === 1 ? '' : 's' }}</span>
            </span>
            <CopyButton :text="outputs.yaml" label="Copy" icon-only />
          </div>
          <pre v-if="outputs.yaml" class="drc__code"><code>{{ outputs.yaml }}</code></pre>
          <p v-else class="drc__empty">Conversion produced an empty result.</p>
          <div v-if="outputs.warnings.length > 0" class="drc__warnings">
            <div class="drc__warnings-head">
              <TriangleAlert :size="13" />
              <span>{{ outputs.warnings.length }} warning{{ outputs.warnings.length === 1 ? '' : 's' }}</span>
            </div>
            <ul class="drc__warnings-list">
              <li v-for="(w, idx) in outputs.warnings" :key="idx">{{ w }}</li>
            </ul>
          </div>
          <div class="drc__meta">
            <span>{{ metaLine }}</span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.drc {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.drc__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.drc__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-muted);
}
.drc__textarea {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 180px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.drc__textarea--mono {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
}
.drc__textarea:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.drc__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--qt-accent);
  border: 1px solid var(--qt-accent);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition:
    transform 0.1s ease,
    opacity 0.15s ease;
  will-change: transform;
}
.drc__btn:hover:not(:disabled) {
  transform: translateY(-1px);
}
.drc__btn:active:not(:disabled) {
  transform: translateY(0);
}
.drc__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.drc__btn--ghost {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  color: var(--qt-text);
}
.drc__btn--ghost:hover:not(:disabled) {
  border-color: var(--qt-accent);
  color: var(--qt-accent);
  transform: none;
}
.drc__error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--qt-danger);
  font-size: 13.5px;
  line-height: 1.4;
}
.drc__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.drc__result {
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.drc__result-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.drc__result-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qt-text);
  flex: 1;
}
.drc__code {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
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
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  word-break: break-word;
}
.drc__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--qt-muted);
  flex-wrap: wrap;
}
@media (max-width: 520px) {
  .drc__textarea {
    min-height: 140px;
  }
}
</style>
