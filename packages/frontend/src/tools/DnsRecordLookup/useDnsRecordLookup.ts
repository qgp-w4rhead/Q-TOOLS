/**
 * useDnsRecordLookup - composable + pure logic for DNS record lookup via DoH.
 *
 * Queries DNS-over-HTTPS endpoints (Cloudflare, Google) for A, AAAA, MX, TXT,
 * NS, CNAME, and CAA records. Pure helpers build the DoH URL and parse the
 * JSON response; the composable manages reactive state, fetch calls, and
 * embed integration.
 *
 * No external dependencies.
 */
import { ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type DnsRecordType = 'A' | 'AAAA' | 'MX' | 'TXT' | 'NS' | 'CNAME' | 'CAA';
export type DohProvider = 'cloudflare' | 'google';

export interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DnsResult {
  recordType: DnsRecordType;
  answers: DnsAnswer[];
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - DoH URL building & response parsing                            */
/* -------------------------------------------------------------------------- */

const PROVIDER_URLS: Record<DohProvider, string> = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/resolve',
};

export function buildDohUrl(
  provider: DohProvider,
  domain: string,
  recordType: DnsRecordType,
): string {
  const base = PROVIDER_URLS[provider];
  const params = new URLSearchParams({
    name: domain,
    type: recordType,
  });
  return `${base}?${params.toString()}`;
}

export function buildDohHeaders(provider: DohProvider): Record<string, string> {
  if (provider === 'cloudflare') {
    return { accept: 'application/dns-json' };
  }
  return { accept: 'application/dns-json' };
}

const TYPE_NUMBERS: Record<DnsRecordType, number> = {
  A: 1,
  AAAA: 28,
  MX: 15,
  TXT: 16,
  NS: 2,
  CNAME: 5,
  CAA: 257,
};

const TYPE_NAMES: Record<number, DnsRecordType> = Object.fromEntries(
  Object.entries(TYPE_NUMBERS).map(([k, v]) => [v, k]),
) as Record<number, DnsRecordType>;

export function parseDohResponse(json: unknown): DnsAnswer[] {
  if (!json || typeof json !== 'object') return [];
  const data = json as Record<string, unknown>;
  const answers = data.Answer;
  if (!Array.isArray(answers)) return [];
  return answers.map((a: unknown) => {
    const ans = a as Record<string, unknown>;
    return {
      name: String(ans.name ?? ''),
      type: Number(ans.type ?? 0),
      TTL: Number(ans.TTL ?? 0),
      data: String(ans.data ?? ''),
    };
  });
}

export function formatRecordType(typeNum: number): string {
  return TYPE_NAMES[typeNum] ?? `TYPE${typeNum}`;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + fetch + embed integration                     */
/* -------------------------------------------------------------------------- */

export interface UseDnsRecordLookupReturn {
  domain: Ref<string>;
  recordType: Ref<DnsRecordType>;
  provider: Ref<DohProvider>;
  results: Ref<DnsResult[]>;
  loading: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  lookup: () => Promise<void>;
  reset: () => void;
}

export function useDnsRecordLookup(): UseDnsRecordLookupReturn {
  const domain = ref<string>('example.com');
  const recordType = ref<DnsRecordType>('A');
  const provider = ref<DohProvider>('cloudflare');
  const results = ref<DnsResult[]>([]);
  const loading = ref<boolean>(false);

  async function lookup(): Promise<void> {
    if (!domain.value.trim()) return;
    loading.value = true;
    results.value = [];

    const types: DnsRecordType[] =
      recordType.value === 'A'
        ? [recordType.value]
        : [recordType.value];

    try {
      for (const type of types) {
        const url = buildDohUrl(provider.value, domain.value, type);
        const headers = buildDohHeaders(provider.value);

        const res = await fetch(url, { headers });
        if (!res.ok) {
          results.value.push({
            recordType: type,
            answers: [],
            error: `HTTP ${res.status} ${res.statusText}`,
          });
          continue;
        }

        const json = await res.json();
        const answers = parseDohResponse(json);
        results.value.push({
          recordType: type,
          answers,
          error: null,
        });
      }
    } catch (err) {
      results.value.push({
        recordType: recordType.value,
        answers: [],
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    domain.value = 'example.com';
    recordType.value = 'A';
    provider.value = 'cloudflare';
    results.value = [];
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.domain === 'string') {
        domain.value = p.domain;
      }
      if (typeof p.recordType === 'string') {
        recordType.value = p.recordType as DnsRecordType;
      }
      if (typeof p.provider === 'string') {
        provider.value = p.provider as DohProvider;
      }
      if (p.lookup === true) {
        lookup();
      }
    },
    output: results,
    toOutput: () => ({ domain: domain.value, results: results.value }),
  });

  return {
    domain,
    recordType,
    provider,
    results,
    loading,
    isEmbed,
    embedInput,
    lookup,
    reset,
  };
}
