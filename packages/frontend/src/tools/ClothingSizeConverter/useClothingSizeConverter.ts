/**
 * useClothingSizeConverter - composable + size tables for the clothing and
 * shoe size converter.
 *
 * Bundled conversion tables for men's/women's/kids' shoes (US/UK/EU/JP) and
 * men's/women's tops (US/UK/EU + international letter sizes). Selecting a
 * size in one system highlights the equivalent sizes in the other systems.
 *
 * Tables are approximate - sizing varies by brand. No external deps.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface SizeTable {
  /** Stable id, e.g. "mens-shoes". */
  id: string;
  /** Tab label, e.g. "Men's shoes". */
  label: string;
  /** Column headers, e.g. ["US", "UK", "EU", "JP (cm)"]. */
  columns: string[];
  /** Rows of equivalent sizes, one cell per column. */
  rows: string[][];
}

export interface UseClothingSizeConverterReturn {
  activeTableId: Ref<string>;
  tables: ComputedRef<SizeTable[]>;
  activeTable: ComputedRef<SizeTable | undefined>;
  /** Index of the highlighted row within the active table (-1 = none). */
  selectedRow: Ref<number>;
  /** Column index the user picked a size from. */
  selectedCol: Ref<number>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  selectCell: (row: number, col: number) => void;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Data - approximate standard conversions                                     */
/* -------------------------------------------------------------------------- */

const MENS_SHOES: string[][] = [
  ['6', '5.5', '39', '24'],
  ['6.5', '6', '39.5', '24.5'],
  ['7', '6.5', '40', '25'],
  ['7.5', '7', '40.5', '25.5'],
  ['8', '7.5', '41', '26'],
  ['8.5', '8', '42', '26.5'],
  ['9', '8.5', '42.5', '27'],
  ['9.5', '9', '43', '27.5'],
  ['10', '9.5', '44', '28'],
  ['10.5', '10', '44.5', '28.5'],
  ['11', '10.5', '45', '29'],
  ['11.5', '11', '45.5', '29.5'],
  ['12', '11.5', '46', '30'],
  ['13', '12.5', '47', '31'],
  ['14', '13.5', '48', '32'],
];

const WOMENS_SHOES: string[][] = [
  ['5', '3', '35.5', '22'],
  ['5.5', '3.5', '36', '22.5'],
  ['6', '4', '36.5', '23'],
  ['6.5', '4.5', '37', '23.5'],
  ['7', '5', '37.5', '24'],
  ['7.5', '5.5', '38', '24.5'],
  ['8', '6', '38.5', '25'],
  ['8.5', '6.5', '39', '25.5'],
  ['9', '7', '40', '26'],
  ['9.5', '7.5', '40.5', '26.5'],
  ['10', '8', '41', '27'],
  ['10.5', '8.5', '42', '27.5'],
  ['11', '9', '42.5', '28'],
  ['12', '10', '43.5', '29'],
];

const KIDS_SHOES: string[][] = [
  ['8', '7', '24', '14.5'],
  ['9', '8', '25.5', '15.5'],
  ['10', '9', '27', '16.5'],
  ['11', '10', '28', '17.5'],
  ['12', '11', '29.5', '18.5'],
  ['13', '12', '31', '19.5'],
  ['1', '13', '32', '20'],
  ['2', '1', '33.5', '21'],
  ['3', '2', '35', '22'],
  ['4', '3', '36', '22.5'],
  ['5', '4', '37', '23.5'],
];

const MENS_TOPS: string[][] = [
  ['XS', 'XS', '42', 'XS'],
  ['S', 'S', '44-46', 'S'],
  ['M', 'M', '48-50', 'M'],
  ['L', 'L', '52-54', 'L'],
  ['XL', 'XL', '56-58', 'XL'],
  ['XXL', 'XXL', '60-62', 'XXL'],
  ['3XL', '3XL', '64-66', '3XL'],
];

const WOMENS_TOPS: string[][] = [
  ['0-2', '4-6', '32-34', 'XS'],
  ['4-6', '8-10', '36-38', 'S'],
  ['8-10', '12-14', '40-42', 'M'],
  ['12-14', '16-18', '44-46', 'L'],
  ['16-18', '20-22', '48-50', 'XL'],
  ['20-22', '24-26', '52-54', 'XXL'],
];

export const SIZE_TABLES: SizeTable[] = [
  { id: 'mens-shoes', label: "Men's shoes", columns: ['US', 'UK', 'EU', 'JP (cm)'], rows: MENS_SHOES },
  { id: 'womens-shoes', label: "Women's shoes", columns: ['US', 'UK', 'EU', 'JP (cm)'], rows: WOMENS_SHOES },
  { id: 'kids-shoes', label: "Kids' shoes", columns: ['US', 'UK', 'EU', 'JP (cm)'], rows: KIDS_SHOES },
  { id: 'mens-tops', label: "Men's tops", columns: ['US', 'UK', 'EU', 'Intl'], rows: MENS_TOPS },
  { id: 'womens-tops', label: "Women's tops", columns: ['US', 'UK', 'EU', 'Intl'], rows: WOMENS_TOPS },
];

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useClothingSizeConverter(): UseClothingSizeConverterReturn {
  const activeTableId = ref<string>(SIZE_TABLES[0]?.id ?? '');
  const selectedRow = ref<number>(-1);
  const selectedCol = ref<number>(0);

  const tables = computed<SizeTable[]>(() => SIZE_TABLES);
  const activeTable = computed<SizeTable | undefined>(() =>
    SIZE_TABLES.find((t) => t.id === activeTableId.value),
  );

  function selectCell(row: number, col: number): void {
    selectedRow.value = row;
    selectedCol.value = col;
  }

  function reset(): void {
    activeTableId.value = SIZE_TABLES[0]?.id ?? '';
    selectedRow.value = -1;
    selectedCol.value = 0;
  }

  watch(activeTableId, () => {
    selectedRow.value = -1;
    selectedCol.value = 0;
  });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      const t = p.table ?? p.mode ?? p.category;
      if (typeof t === 'string' && SIZE_TABLES.some((x) => x.id === t)) {
        activeTableId.value = t;
      }
      const size = p.size ?? p.value;
      if (typeof size === 'string' || typeof size === 'number') {
        const needle = String(size).toLowerCase();
        const table = activeTable.value;
        if (table) {
          for (let r = 0; r < table.rows.length; r++) {
            const row = table.rows[r];
            if (!row) continue;
            const col = row.findIndex((c) => c.toLowerCase() === needle);
            if (col >= 0) {
              selectedRow.value = r;
              selectedCol.value = col;
              break;
            }
          }
        }
      }
    },
    output: [selectedRow, selectedCol, activeTableId],
    toOutput: () => {
      const table = activeTable.value;
      const row = table?.rows[selectedRow.value];
      if (!table || !row) {
        return { table: table?.id ?? null, selected: null, equivalents: {} };
      }
      const out: Record<string, string> = {};
      table.columns.forEach((col, i) => {
        out[col] = row[i] ?? '';
      });
      return { table: table.id, selected: row[selectedCol.value] ?? '', equivalents: out };
    },
  });

  return {
    activeTableId,
    tables,
    activeTable,
    selectedRow,
    selectedCol,
    isEmbed,
    embedInput,
    selectCell,
    reset,
  };
}
