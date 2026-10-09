/**
 * useTypographyConverter - composable + unit definitions for the typography
 * unit converter.
 *
 * Converts between typographic length units using the point (pt, 1/72 in)
 * as the base unit: point, pica, pixel (DPI-dependent), em (font-size
 * dependent), inch, millimetre, centimetre, cicero, and didot.
 *
 * The `px` and `em` factors are reactive: `dpi` and `baseFontSize` refs feed
 * a computed unit set so conversions update live when they change.
 *
 * All computations are pure arithmetic - no external dependencies.
 */
import { computed, ref, watch, type Ref } from 'vue';
import {
  useUnitConverter,
  type UnitSet,
  type UseUnitConverterReturn,
} from '@/composables/useUnitConverter';

export type { UnitDef, UnitSet } from '@/composables/useUnitConverter';
export {
  convertUnit as convertTypography,
  formatUnitValue as formatTypography,
} from '@/composables/useUnitConverter';

export interface UseTypographyConverterReturn extends UseUnitConverterReturn {
  /** Dots-per-inch used for the px unit (default 96, CSS reference). */
  dpi: Ref<number>;
  /** Base font size in points used for the em unit (default 12 pt). */
  baseFontSize: Ref<number>;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** 1 pt = 1/72 inch = 25.4/72 mm. */
const PT_PER_INCH = 72;
const MM_PER_PT = 25.4 / PT_PER_INCH;
/** Didot point: 1 didot = 1/2660 m ≈ 0.37597151 mm. */
const DIDOT_MM = 1 / 2.66;
/** Cicero = 12 didot. */
const CICERO_MM = 12 * DIDOT_MM;

/**
 * Build the typography unit set for a given DPI and base font size (pt).
 */
export function buildTypographyUnits(dpi: number, baseFontSizePt: number): UnitSet[] {
  const safeDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : 96;
  const safeEm = Number.isFinite(baseFontSizePt) && baseFontSizePt > 0 ? baseFontSizePt : 12;
  return [
    {
      id: 'typography',
      label: 'Typography',
      units: [
        { id: 'pt', label: 'Point', symbol: 'pt', toBase: 1 },
        { id: 'pica', label: 'Pica', symbol: 'pc', toBase: 12 },
        { id: 'px', label: `Pixel (@ ${safeDpi} DPI)`, symbol: 'px', toBase: PT_PER_INCH / safeDpi },
        { id: 'em', label: `Em (@ ${safeEm} pt)`, symbol: 'em', toBase: safeEm },
        { id: 'in', label: 'Inch', symbol: 'in', toBase: PT_PER_INCH },
        { id: 'mm', label: 'Millimetre', symbol: 'mm', toBase: 1 / MM_PER_PT },
        { id: 'cm', label: 'Centimetre', symbol: 'cm', toBase: 10 / MM_PER_PT },
        { id: 'cicero', label: 'Cicero', symbol: 'cc', toBase: CICERO_MM / MM_PER_PT },
        { id: 'didot', label: 'Didot point', symbol: 'dd', toBase: DIDOT_MM / MM_PER_PT },
      ],
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export function useTypographyConverter(): UseTypographyConverterReturn {
  const dpi = ref<number>(96);
  const baseFontSize = ref<number>(12);

  const sets = computed<UnitSet[]>(() =>
    buildTypographyUnits(dpi.value, baseFontSize.value),
  );

  const base = useUnitConverter({
    sets,
    defaultUnitId: 'pt',
  });

  // Keep embed output flowing when dpi/baseFontSize change (results watch
  // inside useUnitConverter already fires via the units computed).
  watch([dpi, baseFontSize], () => {
    // results recompute is triggered by the `units` watcher in the engine;
    // nothing extra needed here.
  });

  return {
    ...base,
    dpi,
    baseFontSize,
  };
}
