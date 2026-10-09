/**
 * useContentTypeNegotiator — composable + pure logic for parsing Accept headers
 * and showing matched MIME types with quality factors.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface AcceptEntry {
  type: string;
  subtype: string;
  quality: number;
  params: Record<string, string>;
  raw: string;
}

export interface NegotiationResult {
  entries: AcceptEntry[];
  sorted: AcceptEntry[];
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

export function parseAcceptHeader(header: string): NegotiationResult {
  const errors: string[] = [];
  const entries: AcceptEntry[] = [];

  if (!header.trim()) {
    return { entries, sorted: [], errors: ['Empty Accept header.'] };
  }

  const parts = header.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (!part) continue;
    const segments = part.split(';').map((s) => s.trim());
    const mediaType = segments[0] ?? '';
    if (!mediaType) continue;

    const [type, subtype] = mediaType.split('/');
    if (!type || !subtype) {
      errors.push(`Invalid media type: "${mediaType}"`);
      continue;
    }

    let quality = 1.0;
    const params: Record<string, string> = {};

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i] ?? '';
      const eqIdx = seg.indexOf('=');
      if (eqIdx === -1) continue;
      const key = seg.slice(0, eqIdx).trim();
      const value = seg.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key === 'q') {
        const q = parseFloat(value);
        if (!isNaN(q)) quality = Math.min(Math.max(q, 0), 1);
      } else {
        params[key] = value;
      }
    }

    entries.push({ type, subtype, quality, params, raw: part });
  }

  const sorted = [...entries].sort((a, b) => b.quality - a.quality);

  return { entries, sorted, errors };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseContentTypeNegotiatorReturn {
  input: Ref<string>;
  result: ComputedRef<NegotiationResult>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useContentTypeNegotiator(): UseContentTypeNegotiatorReturn {
  const input = ref('');

  const result = computed(() => parseAcceptHeader(input.value));

  function reset(): void {
    input.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
    },
    output: result,
    toOutput: () => ({ count: result.value.sorted.length }),
  });

  return { input, result, reset, isEmbed, embedInput };
}
