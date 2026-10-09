/**
 * usePolybiusSquare - composable + pure logic for the Polybius Square tool.
 *
 * A coordinate-based substitution cipher. Each letter is mapped to a
 * two-digit coordinate (row, column) in a grid. The standard 5×5 grid
 * merges I and J. A configurable grid size (5×5 or 6×6) is supported;
 * the 6×6 grid includes digits 0–9 and does not merge any letters.
 *
 *   Encode: text → digit pairs (e.g. "HELLO" → "23 15 31 31 34")
 *   Decode: digit pairs → text
 *
 * Pure helpers (`buildPolybiusGrid`, `polybiusEncrypt`, `polybiusDecrypt`)
 * have no Vue dependency. The `usePolybiusSquare()` composable wraps them
 * in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** Supported grid sizes. */
export type GridSize = 5 | 6;

/** Default grid size. */
export const DEFAULT_GRID_SIZE: GridSize = 5;

/** Default separator between coordinate pairs. */
export const DEFAULT_SEPARATOR = ' ';

/**
 * Build the Polybius grid for the given size.
 *
 * 5×5: A–Z with I/J merged (26 → 25 cells).
 * 6×6: A–Z + 0–9 (36 cells, no merging).
 *
 * Returns a flat array of characters (row-major) and a map from
 * character → [row, col] (1-indexed).
 */
export function buildPolybiusGrid(size: GridSize): {
  grid: string[];
  charToCoord: Map<string, [number, number]>;
  coordToChar: Map<string, string>;
} {
  let alphabet: string;
  if (size === 5) {
    // Standard 5×5: I and J share a cell. We use I for both.
    alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  } else {
    // 6×6: A–Z + 0–9
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  }

  const grid: string[] = alphabet.split('');
  const charToCoord = new Map<string, [number, number]>();
  const coordToChar = new Map<string, string>();

  for (let i = 0; i < grid.length; i++) {
    const row = Math.floor(i / size) + 1;
    const col = (i % size) + 1;
    charToCoord.set(grid[i]!, [row, col]);
    coordToChar.set(`${row}${col}`, grid[i]!);
    // For 5×5, J maps to I's cell.
    if (size === 5 && grid[i] === 'I') {
      charToCoord.set('J', [row, col]);
    }
  }

  return { grid, charToCoord, coordToChar };
}

/**
 * Encode `text` into Polybius coordinate pairs using a grid of the given
 * `size`. Non-alphabetic characters (and non-digit characters in 6×6 mode)
 * are preserved verbatim. Coordinate pairs are joined by `separator`.
 */
export function polybiusEncrypt(
  text: string,
  size: GridSize = DEFAULT_GRID_SIZE,
  separator: string = DEFAULT_SEPARATOR,
): string {
  if (!text) return '';
  const { charToCoord } = buildPolybiusGrid(size);
  const parts: string[] = [];
  for (const ch of text) {
    const upper = ch.toUpperCase();
    const coord = charToCoord.get(upper);
    if (coord) {
      parts.push(`${coord[0]}${coord[1]}`);
    } else {
      parts.push(ch);
    }
  }
  return parts.join(separator);
}

/**
 * Decode Polybius coordinate pairs back to text. Expects digit pairs
 * (row, column) separated by `separator` or whitespace. Non-digit
 * sequences are preserved verbatim.
 */
export function polybiusDecrypt(
  input: string,
  size: GridSize = DEFAULT_GRID_SIZE,
): string {
  if (!input) return '';
  const { coordToChar } = buildPolybiusGrid(size);
  // Extract all 2-digit pairs and non-digit runs.
  let out = '';
  let i = 0;
  const trimmed = input.replace(/\s+/g, ' ');
  while (i < trimmed.length) {
    // Try to read a 2-digit pair.
    if (i + 1 < trimmed.length && /\d/.test(trimmed[i]!) && /\d/.test(trimmed[i + 1]!)) {
      const key = trimmed.slice(i, i + 2);
      const ch = coordToChar.get(key);
      if (ch) {
        out += ch;
        i += 2;
        // Skip a single separator space.
        if (trimmed[i] === ' ') i++;
        continue;
      }
    }
    // Non-digit or unrecognized - emit verbatim.
    out += trimmed[i]!;
    i++;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

/** Conversion mode. */
export type PolybiusMode = 'encode' | 'decode';

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 120;

export interface UsePolybiusSquareReturn {
  input: Ref<string>;
  mode: Ref<PolybiusMode>;
  gridSize: Ref<GridSize>;
  output: Ref<string>;
  grid: Ref<string[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
  setMode: (m: PolybiusMode) => void;
  setGridSize: (s: GridSize) => void;
  swap: () => void;
}

export function usePolybiusSquare(): UsePolybiusSquareReturn {
  const input = ref<string>('');
  const mode = ref<PolybiusMode>('encode');
  const gridSize = ref<GridSize>(DEFAULT_GRID_SIZE);
  const output = ref<string>('');
  const grid = ref<string[]>([]);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    grid.value = buildPolybiusGrid(gridSize.value).grid;
    if (text.length === 0) {
      output.value = '';
      return;
    }
    output.value =
      mode.value === 'encode'
        ? polybiusEncrypt(text, gridSize.value)
        : polybiusDecrypt(text, gridSize.value);
  }

  function scheduleRun(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      run();
    }, DEBOUNCE_MS);
  }

  function recompute(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    run();
  }

  function setMode(m: PolybiusMode): void {
    mode.value = m;
  }

  function setGridSize(s: GridSize): void {
    gridSize.value = s;
  }

  function swap(): void {
    if (output.value) {
      input.value = output.value;
    }
    mode.value = mode.value === 'encode' ? 'decode' : 'encode';
  }

  watch(input, scheduleRun);
  watch(mode, scheduleRun);
  watch(gridSize, scheduleRun);

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') input.value = p.input;
      if (typeof p.mode === 'string' && (p.mode === 'encode' || p.mode === 'decode')) {
        mode.value = p.mode;
      }
      if (typeof p.gridSize === 'number' && (p.gridSize === 5 || p.gridSize === 6)) {
        gridSize.value = p.gridSize;
      }
    },
    output,
    toOutput: () => ({ output: output.value, mode: mode.value, gridSize: gridSize.value }),
  });

  return {
    input,
    mode,
    gridSize,
    output,
    grid,
    isEmbed,
    embedInput,
    recompute,
    setMode,
    setGridSize,
    swap,
  };
}
