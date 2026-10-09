<script setup lang="ts">
/**
 * PortReference - searchable well-known port → service table.
 *
 * Bundled, curated subset of the IANA port registry (~190 entries). A single
 * search box auto-detects numeric (port) vs text (service/description)
 * queries; protocol chips narrow by TCP/UDP. Results are ranked by relevance
 * and capped at 100 rows for display.
 *
 * Works in embed mode: receives `query`/`search`/`port`/`service`/`input`/
 * `value` PostMessages to pre-fill the search and `protocol` to set the
 * transport filter; sends `output` PostMessages with the ranked results.
 *
 * No external dependencies - the port table is bundled with the tool chunk.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search } from 'lucide-vue-next';
import ToolInput from '@/components/ToolInput.vue';
import ToolOutput from '@/components/ToolOutput.vue';
import CopyButton from '@/components/CopyButton.vue';
import { usePortReference, type ProtocolFilter } from './usePortReference';
import { portCategory } from './ports';

const { t } = useI18n();
const U = 'tools.port-reference.ui.';

const { query, protocol, results, total, setQuery, setProtocol } =
  usePortReference();

const DISPLAY_CAP = 100;
const displayed = computed(() => results.value.slice(0, DISPLAY_CAP));
const truncated = computed(() => total.value > DISPLAY_CAP);

const PROTOCOLS = computed<{ id: ProtocolFilter; label: string }[]>(() => [
  { id: 'all', label: t(U + 'protoAll') },
  { id: 'tcp', label: 'TCP' },
  { id: 'udp', label: 'UDP' },
]);

function onQueryInput(e: Event): void {
  setQuery((e.target as HTMLInputElement).value);
}

const copyAllText = computed(() =>
  displayed.value
    .map(
      (r) =>
        `${r.entry.port}/${r.entry.protocol === 'both' ? 'tcp+udp' : r.entry.protocol}\t${r.entry.service}\t${r.entry.description}`,
    )
    .join('\n'),
);

function categoryLabel(port: number): string {
  const c = portCategory(port);
  return c === 'well-known'
    ? t(U + 'catWellKnown')
    : c === 'registered'
      ? t(U + 'catRegistered')
      : t(U + 'catDynamic');
}
</script>

<template>
  <div class="qt-tool">
    <ToolInput
      :title="t(U + 'inputTitle')"
      :description="t(U + 'desc')"
    >
      <div class="qt-input-wrap">
        <Search :size="15" class="ports__search-icon" />
        <input
          class="qt-input"
          style="font-size:13.5px;padding:8px 10px 8px 32px"
          type="text"
          :placeholder="t(U + 'phSearch')"
          :value="query"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @input="onQueryInput"
        />
      </div>
      <div class="qt-row qt-row--center" style="--qt-row-gap:6px">
        <button
          v-for="p in PROTOCOLS"
          :key="p.id"
          type="button"
          class="qt-chip qt-chip--filled"
          style="padding:4px 12px"
          :class="{ 'qt-chip--active': protocol === p.id }"
          @click="setProtocol(p.id)"
        >
          {{ p.label }}
        </button>
        <span style="margin-left:auto;font-size:12px;color:var(--qt-muted);font-weight:600">{{ t(U + (total === 1 ? 'resultsCountOne' : 'resultsCount'), { n: total }) }}</span>
      </div>
    </ToolInput>

    <ToolOutput
      :title="t(U + 'outTitle')"
      :description="total ? t(U + (total === 1 ? 'descResultsOne' : 'descResults'), { n: total }) : t(U + 'descNone')"
      :copy-text="copyAllText"
      :copy-label="t(U + 'copyResults')"
    >
      <template v-if="total === 0">
        <p class="qt-alert qt-alert--empty">{{ t(U + 'alertEmpty') }}</p>
      </template>
      <template v-else>
        <div class="ports__table">
          <div class="ports__thead">
            <span>{{ t(U + 'colPort') }}</span>
            <span>{{ t(U + 'colProto') }}</span>
            <span>{{ t(U + 'colService') }}</span>
            <span>{{ t(U + 'colDesc') }}</span>
            <span />
          </div>
          <div
            v-for="r in displayed"
            :key="`${r.entry.port}-${r.entry.protocol}`"
            class="ports__row"
          >
            <code class="ports__port">{{ r.entry.port }}</code>
            <span
              class="ports__proto"
              :class="`ports__proto--${r.entry.protocol}`"
            >{{ r.entry.protocol === 'both' ? 'tcp+udp' : r.entry.protocol }}</span>
            <code class="ports__service">{{ r.entry.service }}</code>
            <span class="ports__desc">
              {{ r.entry.description }}
              <span class="ports__cat">{{ categoryLabel(r.entry.port) }}</span>
            </span>
            <CopyButton
              :text="`${r.entry.port}/${r.entry.protocol === 'both' ? 'tcp+udp' : r.entry.protocol} ${r.entry.service}`"
              icon-only
              :label="t('common.copy')"
            />
          </div>
        </div>
        <p v-if="truncated" style="margin:8px 0 0;font-size:12px;color:var(--qt-muted)">
          {{ t(U + 'truncated', { cap: DISPLAY_CAP, total }) }}
        </p>
      </template>
    </ToolOutput>
  </div>
</template>

<style scoped>
/* Kept scoped: patterns unique to this tool (no generic utility). */

/* Leading icon inside .qt-input-wrap (the wrap only pads for a right button). */
.ports__search-icon {
  position: absolute;
  left: 10px;
  color: var(--qt-muted);
  pointer-events: none;
}

/* Results table — fixed-column grid with a header + hover + narrow re-layout. */
.ports__table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--qt-border);
  border-radius: var(--qt-radius-sm);
  overflow: hidden;
}
.ports__thead,
.ports__row {
  display: grid;
  grid-template-columns: 64px 72px 140px 1fr 34px;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
}
.ports__thead {
  background: var(--qt-bg);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--qt-muted);
  border-bottom: 1px solid var(--qt-border);
}
.ports__row {
  border-bottom: 1px solid var(--qt-border);
  font-size: 13px;
}
.ports__row:last-child {
  border-bottom: none;
}
.ports__row:hover {
  background: oklch(from var(--qt-accent) 90% c h / 0.05);
}
.ports__port {
  font-family: var(--qt-font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--qt-text);
}
.ports__proto {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ports__proto--tcp {
  color: var(--qt-accent);
}
.ports__proto--udp {
  color: var(--qt-warning);
}
.ports__proto--both {
  color: var(--qt-success);
}
.ports__service {
  font-family: var(--qt-font-mono);
  font-size: 12.5px;
  color: var(--qt-text);
  word-break: break-all;
}
.ports__desc {
  color: var(--qt-muted);
  font-size: 12.5px;
}
.ports__cat {
  margin-left: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qt-muted);
  opacity: 0.7;
}

@media (max-width: 640px) {
  .ports__thead {
    display: none;
  }
  .ports__row {
    grid-template-columns: 56px 64px 1fr 34px;
    grid-template-areas:
      'port proto service copy'
      'port proto desc copy';
  }
  .ports__port { grid-area: port; }
  .ports__proto { grid-area: proto; }
  .ports__service { grid-area: service; }
  .ports__desc { grid-area: desc; }
}
</style>
