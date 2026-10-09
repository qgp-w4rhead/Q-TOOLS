/**
 * usePaperSizeConverter - composable + data for the paper size reference.
 *
 * Bundled table of ISO 216 A/B/C series and common North American paper
 * sizes with millimetre and inch dimensions. Searchable by name; selecting
 * a size shows its closest ISO A-series equivalent by area.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface PaperSize {
  /** Display name, e.g. "A4". */
  name: string;
  /** Series group, e.g. "ISO A". */
  series: string;
  /** Width in millimetres (portrait). */
  widthMm: number;
  /** Height in millimetres (portrait). */
  heightMm: number;
}

export interface UsePaperSizeConverterReturn {
  query: Ref<string>;
  seriesFilter: Ref<string>;
  filtered: ComputedRef<PaperSize[]>;
  selected: Ref<PaperSize | null>;
  closestIsoA: ComputedRef<PaperSize | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  select: (size: PaperSize) => void;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

const MM_PER_INCH = 25.4;

function iso(name: string, series: string, w: number, h: number): PaperSize {
  return { name, series, widthMm: w, heightMm: h };
}
function us(name: string, wIn: number, hIn: number): PaperSize {
  return {
    name,
    series: 'US',
    widthMm: Math.round(wIn * MM_PER_INCH * 10) / 10,
    heightMm: Math.round(hIn * MM_PER_INCH * 10) / 10,
  };
}

export const PAPER_SIZES: PaperSize[] = [
  // ISO A series (ISO 216)
  iso('A0', 'ISO A', 841, 1189),
  iso('A1', 'ISO A', 594, 841),
  iso('A2', 'ISO A', 420, 594),
  iso('A3', 'ISO A', 297, 420),
  iso('A4', 'ISO A', 210, 297),
  iso('A5', 'ISO A', 148, 210),
  iso('A6', 'ISO A', 105, 148),
  iso('A7', 'ISO A', 74, 105),
  iso('A8', 'ISO A', 52, 74),
  iso('A9', 'ISO A', 37, 52),
  iso('A10', 'ISO A', 26, 37),
  // ISO B series
  iso('B0', 'ISO B', 1000, 1414),
  iso('B1', 'ISO B', 707, 1000),
  iso('B2', 'ISO B', 500, 707),
  iso('B3', 'ISO B', 353, 500),
  iso('B4', 'ISO B', 250, 353),
  iso('B5', 'ISO B', 176, 250),
  iso('B6', 'ISO B', 125, 176),
  iso('B7', 'ISO B', 88, 125),
  iso('B8', 'ISO B', 62, 88),
  iso('B9', 'ISO B', 44, 62),
  iso('B10', 'ISO B', 31, 44),
  // ISO C series (envelopes)
  iso('C0', 'ISO C', 917, 1297),
  iso('C1', 'ISO C', 648, 917),
  iso('C2', 'ISO C', 458, 648),
  iso('C3', 'ISO C', 324, 458),
  iso('C4', 'ISO C', 229, 324),
  iso('C5', 'ISO C', 162, 229),
  iso('C6', 'ISO C', 114, 162),
  iso('C7', 'ISO C', 81, 114),
  iso('C8', 'ISO C', 57, 81),
  iso('C9', 'ISO C', 40, 57),
  iso('C10', 'ISO C', 28, 40),
  // North American sizes
  us('Letter', 8.5, 11),
  us('Legal', 8.5, 14),
  us('Tabloid', 11, 17),
  us('Ledger', 17, 11),
  us('Executive', 7.25, 10.5),
  us('Statement', 5.5, 8.5),
  us('Junior Legal', 5, 8),
  us('Half Letter', 5.5, 8.5),
  us('Government Letter', 8, 10.5),
  us('Government Legal', 8.5, 13),
  us('ANSI A (Letter)', 8.5, 11),
  us('ANSI B (Tabloid)', 11, 17),
  us('ANSI C', 17, 22),
  us('ANSI D', 22, 34),
  us('ANSI E', 34, 44),
  us('Arch A', 9, 12),
  us('Arch B', 12, 18),
  us('Arch C', 18, 24),
  us('Arch D', 24, 36),
  us('Arch E', 36, 48),
];

export const PAPER_SERIES: string[] = ['All', 'ISO A', 'ISO B', 'ISO C', 'US'];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

/** Format millimetres as inches with 2 decimals. */
export function mmToInches(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * 100) / 100;
}

/** Area in square millimetres. */
export function areaMm2(size: PaperSize): number {
  return size.widthMm * size.heightMm;
}

/**
 * Find the ISO A-series size with the closest area to `size`.
 * Returns `null` when `size` is itself an ISO A size.
 */
export function closestIsoASize(size: PaperSize): PaperSize | null {
  if (size.series === 'ISO A') return null;
  const target = areaMm2(size);
  let best: PaperSize | null = null;
  let bestDiff = Infinity;
  for (const s of PAPER_SIZES) {
    if (s.series !== 'ISO A') continue;
    const diff = Math.abs(areaMm2(s) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

/** Filter sizes by a free-text query (name or series). */
export function filterPaperSizes(query: string, series: string): PaperSize[] {
  const q = query.trim().toLowerCase();
  return PAPER_SIZES.filter((s) => {
    if (series !== 'All' && s.series !== series) return false;
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) || s.series.toLowerCase().includes(q)
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function usePaperSizeConverter(): UsePaperSizeConverterReturn {
  const query = ref<string>('');
  const seriesFilter = ref<string>('All');
  const selected = ref<PaperSize | null>(null);

  const filtered = computed<PaperSize[]>(() =>
    filterPaperSizes(query.value, seriesFilter.value),
  );

  const closestIsoA = computed<PaperSize | null>(() =>
    selected.value ? closestIsoASize(selected.value) : null,
  );

  function select(size: PaperSize): void {
    selected.value = size;
  }

  function reset(): void {
    query.value = '';
    seriesFilter.value = 'All';
    selected.value = null;
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const q = p.query ?? p.search ?? p.size ?? p.name;
      if (typeof q === 'string') {
        query.value = q;
        const exact = PAPER_SIZES.find(
          (s) => s.name.toLowerCase() === q.trim().toLowerCase(),
        );
        if (exact) selected.value = exact;
      }
      if (typeof p.series === 'string' && PAPER_SERIES.includes(p.series)) {
        seriesFilter.value = p.series;
      }
    },
    output: selected,
    toOutput: () => {
      const s = selected.value;
      if (!s) {
        return {
          selected: null,
          series: null,
          widthMm: null,
          heightMm: null,
          widthIn: null,
          heightIn: null,
          closestIsoA: null,
        };
      }
      return {
        selected: s.name,
        series: s.series,
        widthMm: s.widthMm,
        heightMm: s.heightMm,
        widthIn: mmToInches(s.widthMm),
        heightIn: mmToInches(s.heightMm),
        closestIsoA: closestIsoA.value?.name ?? null,
      };
    },
  });

  return {
    query,
    seriesFilter,
    filtered,
    selected,
    closestIsoA,
    isEmbed,
    embedInput,
    select,
    reset,
  };
}
