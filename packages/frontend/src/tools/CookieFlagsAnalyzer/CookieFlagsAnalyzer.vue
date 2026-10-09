<script setup lang="ts">
/**
 * CookieFlagsAnalyzer - analyze Set-Cookie headers for missing security flags.
 *
 * Parses pasted `Set-Cookie` headers (one per line or a raw header block) and
 * flags missing `Secure`, `HttpOnly`, `SameSite`, `SameSite=None` without
 * `Secure`, broad `Domain` scope, `__Host-`/`__Secure-` prefix violations, and
 * session vs persistent lifetime notes.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `input` PostMessages with `{ input | header |
 * setCookie }`; sends `output` PostMessages with `{ count, cookies }`.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, CheckCircle2, Cookie, Eraser, Info, XCircle } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import ToolField from '@/components/ToolField.vue';
import ToolButton from '@/components/ToolButton.vue';
import ToolAlert from '@/components/ToolAlert.vue';
import { useCookieFlagsAnalyzer, type CookieIssue } from './useCookieFlagsAnalyzer';

const { t } = useI18n();
const U = 'tools.cookie-flags-analyzer.ui.';

const { input, results, clear } = useCookieFlagsAnalyzer();

const levelLabel = computed<Record<string, string>>(() => ({
  ok: t(U + 'lvlOk'),
  error: t(U + 'lvlError'),
  warning: t(U + 'lvlWarning'),
  info: t(U + 'lvlInfo'),
}));

function issueIcon(level: CookieIssue['level']) {
  if (level === 'error') return XCircle;
  if (level === 'warning') return AlertTriangle;
  return Info;
}

function worstLevel(issues: CookieIssue[]): 'error' | 'warning' | 'info' | 'ok' {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.some((i) => i.level === 'warning')) return 'warning';
  if (issues.some((i) => i.level === 'info')) return 'info';
  return 'ok';
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <template #actions>
        <ToolButton v-if="input" @click="clear">
          <Eraser :size="13" /> {{ t('common.clear') }}
        </ToolButton>
      </template>
      <ToolField
        v-model="input"
        as="textarea"
        mono
        :rows="6"
        placeholder="Set-Cookie: session=abc123; Path=/; HttpOnly; Secure; SameSite=Lax&#10;Set-Cookie: prefs=dark; Domain=.example.com"
        spellcheck="false"
      />
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="results.length ? t(results.length === 1 ? U + 'descResultOne' : U + 'descResult', { n: results.length }) : t(U + 'descEmpty')"
      hide-copy
    >
      <template v-if="!results.length">
        <ToolAlert kind="empty">{{ t(U + 'alertEmpty') }}</ToolAlert>
      </template>
      <template v-else>
        <div v-for="(c, i) in results" :key="i" class="qt-result">
          <div class="qt-row qt-row--center" style="--qt-row-gap:8px">
            <Cookie :size="15" style="color:var(--qt-accent)" />
            <span class="qt-mono" style="font-size:13.5px;font-weight:700">{{ c.cookie.name }}</span>
            <span v-if="c.prefix" class="qt-badge qt-badge--info">{{ c.prefix }}</span>
            <span class="qt-badge" style="margin-left:auto" :class="`qt-badge--${worstLevel(c.issues) === 'ok' ? 'success' : worstLevel(c.issues) === 'info' ? 'muted' : worstLevel(c.issues) === 'warning' ? 'warn' : 'error'}`">
              <CheckCircle2 v-if="worstLevel(c.issues) === 'ok'" :size="12" />
              <XCircle v-else-if="worstLevel(c.issues) === 'error'" :size="12" />
              <AlertTriangle v-else :size="12" />
              {{ levelLabel[worstLevel(c.issues)] ?? worstLevel(c.issues) }}
            </span>
          </div>

          <div class="qt-row" style="--qt-row-gap:6px">
            <span class="qt-badge" :class="c.secure ? 'qt-badge--success' : 'qt-badge--error'">Secure</span>
            <span class="qt-badge" :class="c.httpOnly ? 'qt-badge--success' : 'qt-badge--error'">HttpOnly</span>
            <span class="qt-badge" :class="c.sameSite ? 'qt-badge--success' : 'qt-badge--error'">
              SameSite{{ c.sameSite ? `=${c.sameSite}` : '' }}
            </span>
            <span v-if="c.partitioned" class="qt-badge qt-badge--success">Partitioned</span>
            <span v-if="c.domain" class="qt-badge qt-badge--muted">Domain={{ c.domain }}</span>
            <span v-if="c.path" class="qt-badge qt-badge--muted">Path={{ c.path }}</span>
            <span v-if="c.maxAge !== null" class="qt-badge qt-badge--muted">Max-Age={{ c.maxAge }}</span>
            <span v-else-if="c.expires" class="qt-badge qt-badge--muted">Expires={{ c.expires }}</span>
            <span v-else class="qt-badge qt-badge--muted">{{ t(U + 'badgeSession') }}</span>
          </div>

          <ul v-if="c.issues.length" class="qt-stack" style="--qt-stack-gap:4px;list-style:none;margin:0;padding:0">
            <li v-for="(iss, j) in c.issues" :key="j" class="cfa__issue" :class="`cfa__issue--${iss.level}`">
              <component :is="issueIcon(iss.level)" :size="12" />
              <span>{{ iss.message }}</span>
            </li>
          </ul>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Issue line — icon + message colored by severity. */
.cfa__issue {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
}
.cfa__issue--error { color: var(--qt-danger); }
.cfa__issue--warning { color: var(--qt-warning); }
.cfa__issue--info { color: var(--qt-muted); }
</style>
