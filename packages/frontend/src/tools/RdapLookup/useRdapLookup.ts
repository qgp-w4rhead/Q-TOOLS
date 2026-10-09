/**
 * useRdapLookup - composable + pure logic for the RDAP / WHOIS lookup tool.
 *
 * Queries the public RDAP bootstrap aggregator `rdap.org`, which redirects
 * to the authoritative registry for the queried domain or IP. Auto-detects
 * the query type: dotted-quad / colon input → IP endpoint, anything else →
 * domain endpoint.
 *
 * The RDAP JSON is flattened into a display-friendly summary: handle,
 * name, status, events (registration / expiration / last-changed), entities
 * (registrar, registrant, …), nameservers, and remarks. IP responses also
 * expose the network range and country.
 *
 * Pure helpers (`detectQueryType`, `buildRdapUrl`, `vcardField`,
 * `parseRdapResponse`) have no Vue dependency and can be imported standalone
 * for unit testing or reuse. The `useRdapLookup()` composable manages
 * reactive state, fetch calls, and embed integration.
 *
 * No external dependencies - uses the browser `fetch` API. Requires network
 * access; failures are surfaced as errors.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export type RdapQueryType = 'domain' | 'ip';

export interface RdapEvent {
  action: string;
  date: string;
}

export interface RdapEntity {
  handle: string;
  roles: string[];
  /** Display name from the vCard `fn` field, when present. */
  name: string | null;
}

export interface RdapResult {
  /** What was looked up. */
  query: string;
  queryType: RdapQueryType;
  /** RDAP object class (`domain`, `ip network`, `entity`, …). */
  objectClass: string;
  /** Registry handle / object name. */
  handle: string;
  /** Domain name (`ldhName`) or network name. */
  name: string | null;
  /** Status strings (e.g. `client transfer prohibited`). */
  status: string[];
  /** Lifecycle events (registration, expiration, last changed, …). */
  events: RdapEvent[];
  /** Associated entities (registrar, registrant, contacts). */
  entities: RdapEntity[];
  /** Nameserver hostnames (domain objects only). */
  nameservers: string[];
  /** IP network range `start - end` (IP objects only). */
  ipRange: string | null;
  /** ISO country code (IP objects only). */
  country: string | null;
  /** Network type / allocation (IP objects only). */
  ipType: string | null;
  /** Plain-text remark / notice lines. */
  remarks: string[];
  /** The RDAP URL that was queried. */
  url: string;
}

/** Detect whether the query is an IP address or a domain name. */
export function detectQueryType(query: string): RdapQueryType {
  const q = query.trim();
  // IPv6: contains a colon.
  if (q.includes(':')) return 'ip';
  // IPv4: 4 dot-separated numeric octets.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(q)) return 'ip';
  return 'domain';
}

/** Build the rdap.org URL for a query. */
export function buildRdapUrl(query: string, type: RdapQueryType): string {
  const q = encodeURIComponent(query.trim());
  return type === 'ip' ? `https://rdap.org/ip/${q}` : `https://rdap.org/domain/${q}`;
}

/** Extract a vCard field (e.g. `fn`) from an RDAP entity's vcardArray. */
export function vcardField(entity: Record<string, unknown>, field: string): string | null {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || vcard.length < 2) return null;
  const props = vcard[1];
  if (!Array.isArray(props)) return null;
  for (const prop of props) {
    if (Array.isArray(prop) && prop[0] === field && typeof prop[3] === 'string') {
      return prop[3];
    }
  }
  return null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/**
 * Flatten an RDAP JSON response into a display-friendly summary.
 * Unknown fields are ignored; missing sections come back empty.
 */
export function parseRdapResponse(json: unknown, query: string, url: string): RdapResult {
  const data = (json ?? {}) as Record<string, unknown>;

  const events: RdapEvent[] = [];
  if (Array.isArray(data.events)) {
    for (const e of data.events) {
      const ev = e as Record<string, unknown>;
      if (typeof ev.eventAction === 'string' && typeof ev.eventDate === 'string') {
        events.push({ action: ev.eventAction, date: ev.eventDate });
      }
    }
  }

  const entities: RdapEntity[] = [];
  const collectEntities = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const ent = item as Record<string, unknown>;
      entities.push({
        handle: typeof ent.handle === 'string' ? ent.handle : '',
        roles: asStringArray(ent.roles),
        name: vcardField(ent, 'fn'),
      });
      // Entities can nest (e.g. registrar → abuse contact).
      if (Array.isArray(ent.entities)) collectEntities(ent.entities);
    }
  };
  collectEntities(data.entities);

  const nameservers: string[] = [];
  if (Array.isArray(data.nameservers)) {
    for (const ns of data.nameservers) {
      const n = ns as Record<string, unknown>;
      const name = n.ldhName ?? n.unicodeName;
      if (typeof name === 'string') nameservers.push(name);
    }
  }

  const remarks: string[] = [];
  const collectRemarks = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const r = item as Record<string, unknown>;
      if (typeof r.title === 'string') remarks.push(r.title);
      if (Array.isArray(r.description)) {
        for (const d of r.description) {
          if (typeof d === 'string') remarks.push(d);
        }
      }
    }
  };
  collectRemarks(data.remarks);
  collectRemarks(data.notices);

  let ipRange: string | null = null;
  if (typeof data.startAddress === 'string' && typeof data.endAddress === 'string') {
    ipRange = `${data.startAddress} - ${data.endAddress}`;
  }

  return {
    query,
    queryType: detectQueryType(query),
    objectClass: typeof data.objectClassName === 'string' ? data.objectClassName : 'unknown',
    handle: typeof data.handle === 'string' ? data.handle : '',
    name:
      (typeof data.ldhName === 'string' && data.ldhName) ||
      (typeof data.name === 'string' && data.name) ||
      null,
    status: asStringArray(data.status),
    events,
    entities,
    nameservers,
    ipRange,
    country: typeof data.country === 'string' ? data.country : null,
    ipType: typeof data.type === 'string' ? data.type : null,
    remarks,
    url,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + fetch + embed integration                     */
/* -------------------------------------------------------------------------- */

export interface UseRdapLookupReturn {
  query: Ref<string>;
  result: Ref<RdapResult | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  lookup: () => Promise<void>;
  reset: () => void;
}

export function useRdapLookup(): UseRdapLookupReturn {
  const query = ref<string>('');
  const result = ref<RdapResult | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  async function lookup(): Promise<void> {
    const q = query.value.trim();
    if (q.length === 0) return;
    loading.value = true;
    error.value = null;
    result.value = null;
    const type = detectQueryType(q);
    const url = buildRdapUrl(q, type);
    try {
      const res = await fetch(url, { headers: { accept: 'application/rdap+json, application/json' } });
      if (!res.ok) {
        if (res.status === 404) {
          error.value = 'Not found - the registry has no record for this query.';
        } else {
          error.value = `RDAP request failed: HTTP ${res.status} ${res.statusText}`;
        }
        return;
      }
      const json = await res.json();
      result.value = parseRdapResponse(json, q, url);
    } catch (err) {
      error.value =
        err instanceof Error
          ? `Network request failed - this tool requires internet access. (${err.message})`
          : 'Network request failed - this tool requires internet access.';
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    query.value = '';
    result.value = null;
    error.value = null;
  }

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.query === 'string') query.value = p.query;
      else if (typeof p.domain === 'string') query.value = p.domain;
      else if (typeof p.ip === 'string') query.value = p.ip;
      else if (typeof p.input === 'string') query.value = p.input;
      else if (typeof p.value === 'string') query.value = p.value;
      if (p.lookup === true || p.run === true || typeof p.query === 'string' ||
          typeof p.domain === 'string' || typeof p.ip === 'string') {
        void lookup();
      }
    },
  });

  watch([result, error], () => {
    if (isEmbed.value) {
      if (result.value) {
        sendOutput({ ...result.value });
      } else {
        sendOutput({ error: error.value, loading: loading.value });
      }
    }
  });

  return { query, result, loading, error, isEmbed, embedInput, lookup, reset };
}
