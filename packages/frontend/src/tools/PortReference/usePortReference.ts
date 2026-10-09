/**
 * usePortReference - composable + pure logic for the well-known ports
 * reference tool.
 *
 * Bundled, curated subset of the IANA port registry (~190 entries in
 * `ports.ts`). A single search box auto-detects the query type:
 *   - numeric (`80`, `0-1024`, `8080`) → port number match
 *   - text (`http`, `dns`, `sql`)      → service name + description match
 *
 * A protocol filter (`all` / `tcp` / `udp`) narrows results further.
 *
 * Pure helpers (`searchPorts`, `filterByProtocol`, `formatPort`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `usePortReference()` composable wraps them in reactive state and wires up
 * the embed PostMessage protocol.
 *
 * No external dependencies - the port table is bundled with the tool chunk.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';
import { PORTS, portCategory, type PortEntry } from './ports';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type ProtocolFilter = 'all' | 'tcp' | 'udp';

export interface PortSearchResult {
  entry: PortEntry;
  /** Relevance score - lower is better. */
  score: number;
}

/**
 * Filter the port table by transport protocol.
 *
 * `'all'` returns everything; `'tcp'`/`'udp'` return entries whose protocol
 * matches or is `'both'`.
 */
export function filterByProtocol(
  entries: PortEntry[],
  protocol: ProtocolFilter,
): PortEntry[] {
  if (protocol === 'all') return entries;
  return entries.filter((e) => e.protocol === protocol || e.protocol === 'both');
}

/**
 * Search the port table.
 *
 * Scoring (lower = better):
 *   - exact port number match            → 0
 *   - service name exact match           → 1
 *   - service name prefix match          → 2
 *   - service name substring match       → 3
 *   - description substring match        → 4
 *
 * An empty query returns all entries (score 5) so the full table is browsable.
 */
export function searchPorts(
  query: string,
  protocol: ProtocolFilter = 'all',
): PortSearchResult[] {
  const pool = filterByProtocol(PORTS, protocol);
  const q = query.trim().toLowerCase();

  if (q.length === 0) {
    return pool.map((entry) => ({ entry, score: 5 }));
  }

  // Numeric query → port number match (exact or prefix).
  const asNum = Number.parseInt(q, 10);
  const isNumeric = /^\d+$/.test(q) && Number.isFinite(asNum);

  const out: PortSearchResult[] = [];
  for (const entry of pool) {
    let score = -1;
    if (isNumeric) {
      if (entry.port === asNum) score = 0;
      else if (String(entry.port).startsWith(q)) score = 3;
    }
    if (score < 0) {
      const svc = entry.service.toLowerCase();
      const desc = entry.description.toLowerCase();
      if (svc === q) score = 1;
      else if (svc.startsWith(q)) score = 2;
      else if (svc.includes(q)) score = 3;
      else if (desc.includes(q)) score = 4;
      // Also match "port 80" style queries where the numeric part matched.
      else if (isNumeric && String(entry.port).includes(q)) score = 3;
    }
    if (score >= 0) out.push({ entry, score });
  }

  out.sort((a, b) => a.score - b.score || a.entry.port - b.entry.port);
  return out;
}

/** Format a port entry as `port/protocol` (e.g. `53/udp`, `80/tcp`). */
export function formatPort(entry: PortEntry): string {
  return `${entry.port}/${entry.protocol === 'both' ? 'tcp+udp' : entry.protocol}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UsePortReferenceReturn {
  query: Ref<string>;
  protocol: Ref<ProtocolFilter>;
  results: ComputedRef<PortSearchResult[]>;
  total: ComputedRef<number>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setQuery: (q: string) => void;
  setProtocol: (p: ProtocolFilter) => void;
}

export function usePortReference(): UsePortReferenceReturn {
  const query = ref<string>('');
  const protocol = ref<ProtocolFilter>('all');

  const results = computed<PortSearchResult[]>(() =>
    searchPorts(query.value, protocol.value),
  );
  const total = computed(() => results.value.length);

  function setQuery(q: string): void {
    query.value = q;
  }
  function setProtocol(p: ProtocolFilter): void {
    protocol.value = p;
  }

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      else if (typeof p.search === 'string') query.value = p.search;
      else if (typeof p.port === 'number') query.value = String(p.port);
      else if (typeof p.port === 'string') query.value = p.port;
      else if (typeof p.service === 'string') query.value = p.service;
      else if (typeof p.input === 'string') query.value = p.input;
      else if (typeof p.value === 'string') query.value = p.value;
      if (typeof p.protocol === 'string') {
        const v = p.protocol.toLowerCase();
        if (v === 'tcp' || v === 'udp' || v === 'all') {
          protocol.value = v as ProtocolFilter;
        }
      }
    },
  });

  watch([results, protocol], () => {
    if (isEmbed.value) {
      sendOutput({
        query: query.value,
        protocol: protocol.value,
        count: total.value,
        results: results.value.slice(0, 100).map((r) => ({
          port: r.entry.port,
          protocol: r.entry.protocol,
          service: r.entry.service,
          description: r.entry.description,
          category: portCategory(r.entry.port),
        })),
      });
    }
  }, { deep: true });

  return {
    query,
    protocol,
    results,
    total,
    isEmbed,
    embedInput,
    setQuery,
    setProtocol,
  };
}
