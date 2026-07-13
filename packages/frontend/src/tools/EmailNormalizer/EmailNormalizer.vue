<script setup lang="ts">
/**
 * EmailNormalizer — normalize an email address for comparison.
 *
 * Parses the input, validates it, and produces a canonical normalized form:
 * lowercased, with the `+suffix` sub-address tag stripped (all providers) and
 * dots stripped from the local part for Gmail-equivalent domains. The tool
 * also reports the local part, domain, validity, disposable-provider status,
 * and the human-readable provider name.
 *
 * No external dependencies.
 *
 * Works in embed mode: receives `email`/`input`/`value`/`address` PostMessages
 * to pre-fill the field; sends `output` PostMessages with
 * `{ normalized, localPart, domain, isValid, isDisposable, provider, … }`
 * whenever the result changes.
 */
import { computed } from 'vue';
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  Mail,
  ShieldAlert,
  Tag,
  Trash2,
} from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import { useEmailNormalizer } from './useEmailNormalizer';

const { input, result } = useEmailNormalizer();

const hasInput = computed(() => input.value.trim().length > 0);

function onInput(e: Event): void {
  input.value = (e.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="emn">
    <ToolInput
      title="Email address"
      description="Enter an email address to normalize. Normalization lowercases the address, strips the +suffix sub-address tag, and strips dots from Gmail local parts."
    >
      <div class="emn__field">
        <Mail :size="16" class="emn__field-icon" />
        <input
          class="emn__input"
          type="email"
          placeholder="John.Doe+newsletter@gmail.com"
          :value="input"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onInput"
        />
      </div>
    </ToolInput>

    <ToolOutput
      title="Normalized email"
      :description="result ? 'Canonical form for de-duplication / comparison.' : 'Enter an email above to normalize it.'"
      :copy-text="result?.isValid ? result.normalized : ''"
      copy-label="Copy"
    >
      <template v-if="!hasInput">
        <p class="emn__empty">Enter an email above to normalize it.</p>
      </template>
      <template v-else-if="result">
        <!-- Validity + disposable badges -->
        <div class="emn__badges">
          <span
            class="emn__badge"
            :class="result.isValid ? 'emn__badge--ok' : 'emn__badge--bad'"
          >
            <component
              :is="result.isValid ? CheckCircle2 : AlertTriangle"
              :size="13"
            />
            <span>{{ result.isValid ? 'Valid' : 'Invalid' }}</span>
          </span>
          <span
            v-if="result.isValid"
            class="emn__badge"
            :class="result.isDisposable ? 'emn__badge--warn' : 'emn__badge--ok'"
          >
            <component
              :is="result.isDisposable ? ShieldAlert : CheckCircle2"
              :size="13"
            />
            <span>{{
              result.isDisposable ? 'Disposable / temp' : 'Not disposable'
            }}</span>
          </span>
          <span v-if="result.isGmail" class="emn__badge emn__badge--info">
            <AtSign :size="13" />
            <span>Gmail-equivalent</span>
          </span>
        </div>

        <!-- Validation error -->
        <p v-if="!result.isValid && result.error" class="emn__error">
          <AlertTriangle :size="13" />
          <span>{{ result.error }}</span>
        </p>

        <!-- Normalized output -->
        <div class="emn__normalized">
          <span class="emn__normalized-label">Normalized</span>
          <code class="emn__normalized-value">{{ result.normalized || '—' }}</code>
        </div>

        <!-- Transformation chips -->
        <div v-if="result.isValid" class="emn__transforms">
          <span
            v-if="result.plusStripped"
            class="emn__chip emn__chip--strip"
            title="Sub-address tag removed"
          >
            <Tag :size="12" />
            <span>+suffix stripped</span>
          </span>
          <span
            v-if="result.dotsStripped"
            class="emn__chip emn__chip--strip"
            title="Dots removed from Gmail local part"
          >
            <Trash2 :size="12" />
            <span>dots stripped</span>
          </span>
          <span
            v-if="!result.plusStripped && !result.dotsStripped"
            class="emn__chip emn__chip--noop"
          >
            <span>no transformations applied</span>
          </span>
        </div>

        <!-- Breakdown grid -->
        <div v-if="result.isValid" class="emn__grid">
          <div class="emn__cell">
            <span class="emn__cell-label">Local part</span>
            <code class="emn__cell-value">{{ result.localPart || '—' }}</code>
          </div>
          <div class="emn__cell">
            <span class="emn__cell-label">Domain</span>
            <code class="emn__cell-value">{{ result.domain || '—' }}</code>
          </div>
          <div class="emn__cell">
            <span class="emn__cell-label">Provider</span>
            <span class="emn__cell-value emn__cell-value--text">{{
              result.provider || '—'
            }}</span>
          </div>
          <div class="emn__cell">
            <span class="emn__cell-label">Disposable</span>
            <span
              class="emn__cell-value emn__cell-value--text"
              :class="result.isDisposable ? 'emn__text-warn' : 'emn__text-ok'"
            >
              {{ result.isDisposable ? 'Yes' : 'No' }}
            </span>
          </div>
        </div>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
.emn {
  display: flex;
  flex-direction: column;
  gap: var(--qt-gap);
  max-width: var(--qt-max-content);
  margin: 0 auto;
}
.emn__field {
  position: relative;
  display: flex;
  align-items: center;
}
.emn__field-icon {
  position: absolute;
  left: 12px;
  color: var(--qt-muted);
  pointer-events: none;
}
.emn__input {
  width: 100%;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font: inherit;
  font-size: 14px;
  padding: 10px 12px 10px 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  will-change: border-color;
}
.emn__input:focus {
  border-color: var(--qt-accent);
  outline: none;
  box-shadow: 0 0 0 2px oklch(from var(--qt-accent) 90% c h / 0.25);
}
.emn__empty {
  margin: 0;
  color: var(--qt-muted);
  font-size: 13.5px;
}
.emn__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.emn__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.emn__badge--ok {
  background: oklch(from var(--qt-success) 35% c h / 0.2);
  border-color: oklch(from var(--qt-success) 60% c h / 0.55);
  color: var(--qt-success);
}
.emn__badge--bad {
  background: oklch(from var(--qt-danger) 35% c h / 0.2);
  border-color: oklch(from var(--qt-danger) 60% c h / 0.55);
  color: var(--qt-danger);
}
.emn__badge--warn {
  background: oklch(from var(--qt-warning) 35% c h / 0.2);
  border-color: oklch(from var(--qt-warning) 60% c h / 0.55);
  color: var(--qt-warning);
}
.emn__badge--info {
  background: oklch(from var(--qt-accent) 35% c h / 0.18);
  border-color: oklch(from var(--qt-accent) 60% c h / 0.5);
  color: var(--qt-accent);
}
.emn__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: oklch(from var(--qt-danger) 35% c h / 0.18);
  border: 1px solid oklch(from var(--qt-danger) 60% c h / 0.5);
  border-radius: var(--qt-radius-sm);
  color: var(--qt-text);
  font-size: 13.5px;
  margin: 0 0 12px;
}
.emn__error svg {
  color: var(--qt-danger);
  flex-shrink: 0;
}
.emn__normalized {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  margin-bottom: 12px;
}
.emn__normalized-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.emn__normalized-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 15px;
  color: var(--qt-text);
  word-break: break-all;
}
.emn__transforms {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.emn__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  border: 1px solid var(--qt-border);
  background: var(--qt-bg);
  color: var(--qt-muted);
}
.emn__chip--strip {
  background: oklch(from var(--qt-accent) 25% c h / 0.15);
  border-color: oklch(from var(--qt-accent) 50% c h / 0.4);
  color: var(--qt-accent);
}
.emn__chip--noop {
  font-style: italic;
  font-weight: 500;
}
.emn__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.emn__cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--qt-bg);
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  min-width: 0;
}
.emn__cell-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
}
.emn__cell-value {
  font-family: 'SFMono-Regular', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 13px;
  color: var(--qt-text);
  word-break: break-all;
}
.emn__cell-value--text {
  font-family: inherit;
  font-size: 13.5px;
}
.emn__text-ok {
  color: var(--qt-success);
  font-weight: 600;
}
.emn__text-warn {
  color: var(--qt-warning);
  font-weight: 600;
}
@media (max-width: 560px) {
  .emn__grid {
    grid-template-columns: 1fr;
  }
}
</style>
