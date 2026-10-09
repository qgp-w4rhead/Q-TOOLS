/**
 * useWhatXWord - fully self-contained three-word coordinate encoder.
 *
 * Encodes lat/lon into 3 pronounceable words and decodes them back.
 * No external API needed — the word list is generated deterministically
 * from syllable patterns at startup.
 *
 * Features over what3words:
 *   - 80K+ word list (vs ~40K)
 *   - Multiple word packs (different phoneme sets)
 *   - Configurable precision (1m to 100m)
 *   - Fully offline, no API key
 *   - Open algorithm
 *
 * Algorithm:
 *   1. Quantize lat/lon to a grid cell
 *   2. Compute a 1D cell ID (latCell * lonCells + lonCell)
 *   3. Split cell ID into 3 parts, each indexing into the word list
 *   4. Join with dots: word1.word2.word3
 *
 * Word generation uses CVC/CVCV/CVCVC syllable patterns for pronounceability.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type WhatXWordMode = 'encode' | 'decode';
export type WordPack = 'classic' | 'crisp' | 'flowing';

export interface WordSuggestion {
  word: string;
  distance: number;
}

export interface WhatXWordResult {
  ok: boolean;
  message?: string;
  words: string | null;
  lat: number | null;
  lon: number | null;
  precision: number | null;
  wordPack: WordPack | null;
  cellSize: number | null;
  suggestions?: WordSuggestion[][];
  unknownPositions?: number[];
  detectedType?: 'words' | 'coordinates' | null;
}

/* -------------------------------------------------------------------------- */
/* Word pack definitions                                                        */
/* -------------------------------------------------------------------------- */

interface PhonemeSet {
  onsets: string[];
  vowels: string[];
  codas: string[];
}

const PHONEME_SETS: Record<WordPack, PhonemeSet> = {
  classic: {
    onsets: ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'z', 'ch', 'sh', 'th', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'bl', 'cl', 'fl', 'gl', 'pl', 'sl', 'sc', 'sk', 'sm', 'sn', 'sp', 'st'],
    vowels: ['a', 'e', 'i', 'o', 'u', 'ay', 'ee', 'ie', 'oa', 'oo'],
    codas: ['b', 'd', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'x', 'ng', 'nk', 'rd', 'rm', 'rn', 'rt', 'st', 'th'],
  },
  crisp: {
    onsets: ['b', 'c', 'd', 'f', 'g', 'k', 'p', 's', 't', 'z', 'ch', 'sh', 'tr', 'kr', 'st', 'sk', 'sp', 'ft', 'pt', 'kt'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
    codas: ['b', 'd', 'g', 'k', 'p', 's', 't', 'x', 'k', 'st', 'sk', 'sp', 'ft', 'pt', 'kt', 'ks', 'ps', 'ts', 'gs', 'dz'],
  },
  flowing: {
    onsets: ['b', 'c', 'd', 'f', 'g', 'h', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'y', 'z', 'fl', 'gl', 'll', 'mn', 'rn', 'sn', 'sw', 'th', 'wh'],
    vowels: ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'ay', 'ea', 'ee', 'ia', 'ie', 'oa', 'oi', 'oo', 'ou', 'ua', 'ue', 'ui', 'ya'],
    codas: ['l', 'm', 'n', 'r', 's', 'w', 'y', 'll', 'lm', 'ln', 'lr', 'ls', 'lw', 'mn', 'ms', 'ns', 'rm', 'rn', 'rs', 'ry'],
  },
};

/* -------------------------------------------------------------------------- */
/* Word list generation                                                        */
/* -------------------------------------------------------------------------- */

const TARGET_WORD_COUNT = 80000;

let cachedWords: Record<WordPack, string[]> | null = null;
let cachedReverseMaps: Record<WordPack, Map<string, number>> | null = null;

function generateWordList(pack: WordPack): string[] {
  const { onsets, vowels, codas } = PHONEME_SETS[pack];
  const words: string[] = [];
  const seen = new Set<string>();

  // Generate words in mixed patterns for variety: CVC, CVCV, CVCVC
  // CVC: onset + vowel + coda
  for (const o of onsets) {
    for (const v of vowels) {
      for (const c of codas) {
        const w = o + v + c;
        if (!seen.has(w)) { seen.add(w); words.push(w); }
        if (words.length >= TARGET_WORD_COUNT) return words;
      }
    }
  }

  // CVCV: onset + vowel + coda + vowel
  for (const o of onsets) {
    for (const v of vowels) {
      for (const c of codas) {
        for (const v2 of vowels) {
          const w = o + v + c + v2;
          if (!seen.has(w)) { seen.add(w); words.push(w); }
          if (words.length >= TARGET_WORD_COUNT) return words;
        }
      }
    }
  }

  // CVCVC: onset + vowel + coda + vowel + coda
  for (const o of onsets) {
    for (const v of vowels) {
      for (const c of codas) {
        for (const v2 of vowels) {
          for (const c2 of codas) {
            const w = o + v + c + v2 + c2;
            if (!seen.has(w)) { seen.add(w); words.push(w); }
            if (words.length >= TARGET_WORD_COUNT) return words;
          }
        }
      }
    }
  }

  return words;
}

function getWordList(pack: WordPack): string[] {
  if (!cachedWords || !cachedReverseMaps) {
    cachedWords = { classic: [], crisp: [], flowing: [] };
    cachedReverseMaps = { classic: new Map(), crisp: new Map(), flowing: new Map() };
  }
  if (cachedWords[pack].length === 0) {
    cachedWords[pack] = generateWordList(pack);
    const map = new Map<string, number>();
    for (let i = 0; i < cachedWords[pack].length; i++) {
      map.set(cachedWords[pack][i]!, i);
    }
    cachedReverseMaps[pack] = map;
  }
  return cachedWords[pack];
}

function getReverseMap(pack: WordPack): Map<string, number> {
  getWordList(pack);
  return cachedReverseMaps![pack]!;
}

/* -------------------------------------------------------------------------- */
/* Grid + encoding                                                              */
/* -------------------------------------------------------------------------- */

const EARTH_CIRCUMFERENCE_M = 40075016.686;
const DEG_PER_M = 360 / EARTH_CIRCUMFERENCE_M; // ≈ 8.983e-6

function getGridParams(precisionM: number) {
  const cellDeg = precisionM * DEG_PER_M;
  const latCells = Math.floor(180 / cellDeg);
  const lonCells = Math.floor(360 / cellDeg);
  return { cellDeg, latCells, lonCells };
}

export function encodeWhatXWord(
  lat: number,
  lon: number,
  precisionM: number,
  pack: WordPack,
): WhatXWordResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, message: 'Enter valid latitude and longitude.', words: null, lat: null, lon: null, precision: null, wordPack: null, cellSize: null };
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, message: 'Coordinates out of range.', words: null, lat: null, lon: null, precision: null, wordPack: null, cellSize: null };
  }

  const { cellDeg, lonCells } = getGridParams(precisionM);
  const words = getWordList(pack);
  const wordCount = words.length;

  // Quantize to grid
  const latCell = Math.floor((lat + 90) / cellDeg);
  const lonCell = Math.floor((lon + 180) / cellDeg);

  // Cell ID
  const cellId = latCell * lonCells + lonCell;

  // Split into 3 word indices
  const w1 = cellId % wordCount;
  const w2 = Math.floor(cellId / wordCount) % wordCount;
  const w3 = Math.floor(cellId / (wordCount * wordCount)) % wordCount;

  const threeWords = `${words[w1]}.${words[w2]}.${words[w3]}`;

  // Center of the cell
  const centerLat = (latCell + 0.5) * cellDeg - 90;
  const centerLon = (lonCell + 0.5) * cellDeg - 180;

  return {
    ok: true,
    words: threeWords,
    lat: Math.round(centerLat * 1e8) / 1e8,
    lon: Math.round(centerLon * 1e8) / 1e8,
    precision: precisionM,
    wordPack: pack,
    cellSize: cellDeg,
  };
}

export function decodeWhatXWord(
  input: string,
  precisionM: number,
  pack: WordPack,
): WhatXWordResult {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '');
  const parts = cleaned.split('.');

  if (parts.length !== 3) {
    return { ok: false, message: 'Enter 3 words separated by dots. Example: bram.lesk.tond', words: null, lat: null, lon: null, precision: null, wordPack: null, cellSize: null, detectedType: 'words' };
  }

  const reverseMap = getReverseMap(pack);
  const indices: (number | undefined)[] = [reverseMap.get(parts[0]!), reverseMap.get(parts[1]!), reverseMap.get(parts[2]!)];
  const unknown = [0, 1, 2].filter((i) => indices[i] === undefined);

  if (unknown.length > 0) {
    const suggestions = unknown.map((i) => suggestClosestWords(parts[i]!, pack, 3));
    const badWords = unknown.map((i) => parts[i]).join(', ');
    return {
      ok: false,
      message: `Unknown word${unknown.length > 1 ? 's' : ''}: ${badWords}. Did you mean: ${suggestions.map((s) => s.map((w) => w.word).join('/')).join(', ')}?`,
      words: null,
      lat: null,
      lon: null,
      precision: null,
      wordPack: null,
      cellSize: null,
      suggestions,
      unknownPositions: unknown,
      detectedType: 'words',
    };
  }

  const w1 = indices[0]!;
  const w2 = indices[1]!;
  const w3 = indices[2]!;

  const words = getWordList(pack);
  const wordCount = words.length;

  const cellId = w1 + w2 * wordCount + w3 * wordCount * wordCount;

  const { cellDeg, latCells, lonCells } = getGridParams(precisionM);

  if (cellId >= latCells * lonCells) {
    return { ok: false, message: 'This word combination does not map to a valid location at the selected precision. Try a different precision setting.', words: null, lat: null, lon: null, precision: null, wordPack: null, cellSize: null, detectedType: 'words' };
  }

  const latCell = Math.floor(cellId / lonCells);
  const lonCell = cellId % lonCells;

  const lat = (latCell + 0.5) * cellDeg - 90;
  const lon = (lonCell + 0.5) * cellDeg - 180;

  return {
    ok: true,
    words: `${parts[0]}.${parts[1]}.${parts[2]}`,
    lat: Math.round(lat * 1e8) / 1e8,
    lon: Math.round(lon * 1e8) / 1e8,
    precision: precisionM,
    wordPack: pack,
    cellSize: cellDeg,
    detectedType: 'words',
  };
}

/* -------------------------------------------------------------------------- */
/* Levenshtein distance + word suggestions                                      */
/* -------------------------------------------------------------------------- */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

export function suggestClosestWords(
  word: string,
  pack: WordPack,
  maxResults = 3,
): WordSuggestion[] {
  const words = getWordList(pack);
  const results: WordSuggestion[] = [];
  const w = word.toLowerCase();

  for (let i = 0; i < words.length; i++) {
    const candidate = words[i]!;
    const dist = levenshtein(w, candidate);
    if (results.length < maxResults || dist < results[results.length - 1]!.distance) {
      results.push({ word: candidate, distance: dist });
      results.sort((a, b) => a.distance - b.distance);
      if (results.length > maxResults) results.pop();
    }
  }

  return results;
}

/* -------------------------------------------------------------------------- */
/* Type detection                                                               */
/* -------------------------------------------------------------------------- */

export type DetectedInputType = 'words' | 'coordinates' | 'unknown';

export function detectInputType(input: string): DetectedInputType {
  const trimmed = input.trim();
  if (!trimmed) return 'unknown';

  // Words: contains dots splitting into alpha-only parts
  const dotParts = trimmed.toLowerCase().split(/\s+/).join('').split('.');
  if (dotParts.length === 3 && dotParts.every((p) => /^[a-z]+$/.test(p))) {
    return 'words';
  }

  // Coordinates: contains numbers, commas, spaces, +/-, N/S/E/W
  const coordPattern = /^\s*[-+]?\d+(?:\.\d+)?\s*[,\s]+\s*[-+]?\d+(?:\.\d+)?\s*$/;
  if (coordPattern.test(trimmed)) return 'coordinates';

  // DMS-like: contains degree/minute/second symbols or hemisphere letters
  if (/[°º'"NSEW]/i.test(trimmed) && /\d/.test(trimmed)) return 'coordinates';

  return 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                   */
/* -------------------------------------------------------------------------- */

export function isValidWhatXWord(input: string, pack: WordPack): boolean {
  const parts = input.trim().toLowerCase().split('.');
  if (parts.length !== 3) return false;
  const reverseMap = getReverseMap(pack);
  return parts.every((p) => reverseMap.has(p));
}

export function getWordCount(pack: WordPack): number {
  return getWordList(pack).length;
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseWhatXWordReturn {
  mode: Ref<WhatXWordMode>;
  autoDetect: Ref<boolean>;
  detectedType: Ref<DetectedInputType>;
  latInput: Ref<string>;
  lonInput: Ref<string>;
  wordsInput: Ref<string>;
  precision: Ref<number>;
  wordPack: Ref<WordPack>;
  snapshot: Ref<WhatXWordResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useWhatXWord(): UseWhatXWordReturn {
  const mode = ref<WhatXWordMode>('encode');
  const autoDetect = ref<boolean>(true);
  const detectedType = ref<DetectedInputType>('unknown');
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const wordsInput = ref<string>('');
  const precision = ref<number>(3);
  const wordPack = ref<WordPack>('classic');
  const snapshot = ref<WhatXWordResult | null>(null);

  function recompute(): void {
    // Auto-detect input type and switch mode if needed
    if (autoDetect.value) {
      const coordText = `${latInput.value} ${lonInput.value}`.trim();
      const wordsText = wordsInput.value.trim();
      if (wordsText) {
        const t = detectInputType(wordsText);
        if (t === 'coordinates') {
          // User pasted coordinates into the words field — switch to encode
          const parts = wordsText.split(/[\s,]+/).filter(Boolean);
          if (parts.length >= 2) {
            latInput.value = parts[0]!;
            lonInput.value = parts[1]!;
            wordsInput.value = '';
            mode.value = 'encode';
            detectedType.value = 'coordinates';
          }
        } else if (t === 'words') {
          detectedType.value = 'words';
          if (mode.value !== 'decode') mode.value = 'decode';
        }
      } else if (coordText) {
        detectedType.value = 'coordinates';
        if (mode.value !== 'encode') mode.value = 'encode';
      } else {
        detectedType.value = 'unknown';
      }
    }

    if (mode.value === 'encode') {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        snapshot.value = null;
        return;
      }
      snapshot.value = encodeWhatXWord(lat, lon, precision.value, wordPack.value);
    } else {
      if (!wordsInput.value.trim()) {
        snapshot.value = null;
        return;
      }
      snapshot.value = decodeWhatXWord(wordsInput.value, precision.value, wordPack.value);
    }
  }

  function reset(): void {
    mode.value = 'encode';
    autoDetect.value = true;
    detectedType.value = 'unknown';
    latInput.value = '';
    lonInput.value = '';
    wordsInput.value = '';
    precision.value = 3;
    wordPack.value = 'classic';
    snapshot.value = null;
  }

  watch([mode, latInput, lonInput, wordsInput, precision, wordPack], () => recompute());
  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string') mode.value = p.mode === 'decode' ? 'decode' : 'encode';
      if (typeof p.lat === 'string' || typeof p.lat === 'number') latInput.value = String(p.lat);
      if (typeof p.lon === 'string' || typeof p.lon === 'number') lonInput.value = String(p.lon);
      if (typeof p.words === 'string') wordsInput.value = p.words;
      if (typeof p.precision === 'number') precision.value = p.precision;
      if (typeof p.wordPack === 'string') {
        const wp = p.wordPack as WordPack;
        if (wp === 'classic' || wp === 'crisp' || wp === 'flowing') wordPack.value = wp;
      }
    },
  });

  watch(snapshot, (s) => {
    if (isEmbed.value) sendOutput(s ?? {});
  });

  return { mode, autoDetect, detectedType, latInput, lonInput, wordsInput, precision, wordPack, snapshot, isEmbed, embedInput, reset };
}
