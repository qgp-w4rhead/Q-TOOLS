<script setup lang="ts">
/**
 * CurlCommandBuilder - build cURL commands from a form, or parse pasted cURL.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RotateCcw, Plus, Trash2, ArrowRightLeft } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import {
  useCurlCommandBuilder,
  type HttpMethod,
} from './useCurlCommandBuilder';

const {
  field,
  curlCommand,
  parseInput,
  parsedResult,
  mode,
  addHeader,
  removeHeader,
  applyParsed,
  reset,
} = useCurlCommandBuilder();

const { t } = useI18n();
const U = 'tools.curl-command-builder.ui.';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

type BuilderMode = 'build' | 'parse';
const modeOptions = computed<Array<{ id: BuilderMode; label: string }>>(() => [
  { id: 'build', label: t(U + 'modeBuild') },
  { id: 'parse', label: t(U + 'modeParse') },
]);

const SAMPLE = `curl -X POST -H 'Content-Type: application/json' -d '{"name":"test","value":42}' https://api.example.com/users`;
</script>

<template>
  <div class="qt-tool">
    <SegmentedControl v-model="mode" :options="modeOptions" />

    <!-- Build mode -->
    <template v-if="mode === 'build'">
      <ToolInput :title="t(U + 'buildTitle')" :description="t(U + 'buildDesc')">
        <template #actions>
          <ToolButton @click="reset">
            <RotateCcw :size="14" />
            <span>{{ t('common.reset') }}</span>
          </ToolButton>
        </template>

        <div class="qt-row" style="--qt-row-gap:10px">
          <label class="qt-field" style="flex:0 0 120px">
            <span class="qt-label">{{ t(U + 'method') }}</span>
            <select class="qt-input" style="font-size:13px;padding:8px 10px" v-model="field.method">
              <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
            </select>
          </label>
          <ToolField
            v-model="field.url"
            :label="t(U + 'url')"
            :placeholder="t(U + 'phUrl')"
            spellcheck="false"
            grow
          />
        </div>

        <div class="qt-stack" style="--qt-stack-gap:6px">
          <div class="qt-row qt-row--center qt-row--between">
            <span class="qt-label">{{ t(U + 'headers') }}</span>
            <ToolButton @click="addHeader">
              <Plus :size="14" />
              <span>{{ t(U + 'add') }}</span>
            </ToolButton>
          </div>
          <div v-for="(h, i) in field.headers" :key="i" class="qt-row qt-row--center" style="--qt-row-gap:6px;flex-wrap:nowrap">
            <input class="qt-input" style="flex:0 0 40%;font-size:13px;padding:8px 10px" v-model="h.key" :placeholder="t(U + 'phHeaderName')" spellcheck="false" />
            <input class="qt-input" style="flex:1;font-size:13px;padding:8px 10px" v-model="h.value" :placeholder="t(U + 'phHeaderValue')" spellcheck="false" />
            <button type="button" class="qt-btn qt-btn--ghost" style="padding:4px;color:var(--qt-muted)" @click="removeHeader(i)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <ToolField
          v-model="field.body"
          :label="t(U + 'body')"
          as="textarea"
          mono
          :placeholder="t(U + 'phBody')"
          spellcheck="false"
          :rows="4"
        />

        <div class="qt-row" style="--qt-row-gap:12px">
          <label class="qt-check">
            <input type="checkbox" v-model="field.includeHeaders" />
            <span>{{ t(U + 'optIncludeHeaders') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" v-model="field.followRedirects" />
            <span>{{ t(U + 'optFollowRedirects') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" v-model="field.insecure" />
            <span>{{ t(U + 'optInsecure') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" v-model="field.compressed" />
            <span>{{ t(U + 'optCompressed') }}</span>
          </label>
          <label class="qt-check">
            <input type="checkbox" v-model="field.verbose" />
            <span>{{ t(U + 'optVerbose') }}</span>
          </label>
        </div>
      </ToolInput>

      <ToolOutput :title="t(U + 'outTitle')" :copy-text="curlCommand">
        <pre class="qt-output" style="margin:0;font-size:13px">{{ curlCommand || t(U + 'outEmpty') }}</pre>
      </ToolOutput>
    </template>

    <!-- Parse mode -->
    <template v-else>
      <ToolInput :title="t(U + 'parseTitle')" :description="t(U + 'parseDesc')">
        <template #actions>
          <ToolButton @click="parseInput = SAMPLE">{{ t(U + 'loadSample') }}</ToolButton>
        </template>
        <ToolField
          v-model="parseInput"
          as="textarea"
          mono
          :placeholder="t(U + 'phParse')"
          spellcheck="false"
          :rows="6"
        />
      </ToolInput>

      <ToolOutput :title="t(U + 'parsedTitle')" :hide-copy="true">
        <template v-if="parseInput.trim()">
          <template v-if="parsedResult.errors.length">
            <ToolAlert v-for="(e, i) in parsedResult.errors" :key="i" kind="error">{{ e }}</ToolAlert>
          </template>
          <div class="qt-stack" style="--qt-stack-gap:8px">
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap"><span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:70px">{{ t(U + 'rMethod') }}</span><span style="font-size:13px;color:var(--qt-text)">{{ parsedResult.method }}</span></div>
            <div class="qt-row" style="--qt-row-gap:8px;flex-wrap:nowrap"><span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:70px">{{ t(U + 'rUrl') }}</span><span style="font-size:13px;color:var(--qt-text)">{{ parsedResult.url || '-' }}</span></div>
            <div v-if="parsedResult.headers.length" class="qt-stack" style="--qt-stack-gap:4px">
              <span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:70px">{{ t(U + 'rHeaders') }}</span>
              <div v-for="(h, i) in parsedResult.headers" :key="i" class="qt-mono" style="font-size:13px;color:var(--qt-text)">{{ h.key }}: {{ h.value }}</div>
            </div>
            <div v-if="parsedResult.body" class="qt-stack" style="--qt-stack-gap:4px">
              <span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:70px">{{ t(U + 'rBody') }}</span>
              <pre class="qt-output" style="margin:0;font-size:13px">{{ parsedResult.body }}</pre>
            </div>
            <div v-if="parsedResult.flags.length" class="qt-stack" style="--qt-stack-gap:4px">
              <span style="font-size:12px;font-weight:700;color:var(--qt-muted);min-width:70px">{{ t(U + 'rFlags') }}</span>
              <span style="font-size:13px;color:var(--qt-text)">{{ parsedResult.flags.join(' ') }}</span>
            </div>
          </div>
          <ToolButton variant="primary" @click="applyParsed">
            <ArrowRightLeft :size="14" />
            <span>{{ t(U + 'loadIntoBuilder') }}</span>
          </ToolButton>
        </template>
        <ToolAlert v-else kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </ToolOutput>
    </template>
  </div>
</template>
