/**
 * useWhat3WordsEncoder - composable for what3words API integration.
 *
 * Converts lat/lon to/from three-word addresses using the what3words API.
 * Requires an API key from https://developer.what3words.com/
 *
 * The API key is provided by the user and stored locally (not persisted).
 * No external dependencies - uses fetch() for API calls.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type W3WMode = 'encode' | 'decode';

export interface W3WResult {
  ok: boolean;
  message?: string;
  loading: boolean;
  words: string | null;
  lat: number | null;
  lon: number | null;
  country: string | null;
  nearestPlace: string | null;
  language: string | null;
  apiError: string | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

const W3W_API_BASE = 'https://api.what3words.com/v3';

/* -------------------------------------------------------------------------- */
/* API calls                                                                     */
/* -------------------------------------------------------------------------- */

async function convertTo3WA(
  lat: number,
  lon: number,
  apiKey: string,
  language = 'en',
): Promise<W3WResult> {
  const url = `${W3W_API_BASE}/convert-to-3wa?coordinates=${lat},${lon}&key=${encodeURIComponent(apiKey)}&language=${language}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        message: data?.error?.message ?? 'API request failed',
        loading: false,
        words: null,
        lat: null,
        lon: null,
        country: null,
        nearestPlace: null,
        language: null,
        apiError: data?.error?.code ?? 'unknown',
      };
    }
    return {
      ok: true,
      loading: false,
      words: data.words,
      lat: data.coordinates?.lat ?? lat,
      lon: data.coordinates?.lng ?? lon,
      country: data.country ?? null,
      nearestPlace: data.nearestPlace ?? null,
      language: data.language ?? language,
      apiError: null,
    };
  } catch (err) {
    return {
      ok: false,
      message: 'Network error. Check your connection and API key.',
      loading: false,
      words: null,
      lat: null,
      lon: null,
      country: null,
      nearestPlace: null,
      language: null,
      apiError: 'network_error',
    };
  }
}

async function convertToCoordinates(
  words: string,
  apiKey: string,
): Promise<W3WResult> {
  const url = `${W3W_API_BASE}/convert-to-coordinates?words=${encodeURIComponent(words)}&key=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        message: data?.error?.message ?? 'API request failed',
        loading: false,
        words: null,
        lat: null,
        lon: null,
        country: null,
        nearestPlace: null,
        language: null,
        apiError: data?.error?.code ?? 'unknown',
      };
    }
    return {
      ok: true,
      loading: false,
      words: data.words,
      lat: data.coordinates?.lat ?? null,
      lon: data.coordinates?.lng ?? null,
      country: data.country ?? null,
      nearestPlace: data.nearestPlace ?? null,
      language: data.language ?? null,
      apiError: null,
    };
  } catch {
    return {
      ok: false,
      message: 'Network error. Check your connection and API key.',
      loading: false,
      words: null,
      lat: null,
      lon: null,
      country: null,
      nearestPlace: null,
      language: null,
      apiError: 'network_error',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                   */
/* -------------------------------------------------------------------------- */

export function isValid3WA(words: string): boolean {
  const parts = words.trim().toLowerCase().split('.');
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[a-z]+$/.test(p));
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                   */
/* -------------------------------------------------------------------------- */

export interface UseWhat3WordsEncoderReturn {
  mode: Ref<W3WMode>;
  apiKey: Ref<string>;
  latInput: Ref<string>;
  lonInput: Ref<string>;
  wordsInput: Ref<string>;
  language: Ref<string>;
  snapshot: Ref<W3WResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
  execute: () => Promise<void>;
}

export function useWhat3WordsEncoder(): UseWhat3WordsEncoderReturn {
  const mode = ref<W3WMode>('encode');
  const apiKey = ref<string>('');
  const latInput = ref<string>('');
  const lonInput = ref<string>('');
  const wordsInput = ref<string>('');
  const language = ref<string>('en');
  const snapshot = ref<W3WResult | null>(null);

  function reset(): void {
    mode.value = 'encode';
    apiKey.value = '';
    latInput.value = '';
    lonInput.value = '';
    wordsInput.value = '';
    language.value = 'en';
    snapshot.value = null;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function execute(): Promise<void> {
    if (!apiKey.value.trim()) {
      snapshot.value = {
        ok: false,
        message: 'Enter your what3words API key.',
        loading: false,
        words: null,
        lat: null,
        lon: null,
        country: null,
        nearestPlace: null,
        language: null,
        apiError: 'no_api_key',
      };
      return;
    }

    if (mode.value === 'encode') {
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        snapshot.value = {
          ok: false,
          message: 'Enter valid latitude and longitude.',
          loading: false,
          words: null,
          lat: null,
          lon: null,
          country: null,
          nearestPlace: null,
          language: null,
          apiError: null,
        };
        return;
      }
      snapshot.value = {
        ok: false,
        loading: true,
        message: 'Converting...',
        words: null,
        lat: null,
        lon: null,
        country: null,
        nearestPlace: null,
        language: null,
        apiError: null,
      };
      snapshot.value = await convertTo3WA(lat, lon, apiKey.value, language.value);
    } else {
      const words = wordsInput.value.trim();
      if (!words) {
        snapshot.value = {
          ok: false,
          message: 'Enter a three-word address.',
          loading: false,
          words: null,
          lat: null,
          lon: null,
          country: null,
          nearestPlace: null,
          language: null,
          apiError: null,
        };
        return;
      }
      if (!isValid3WA(words)) {
        snapshot.value = {
          ok: false,
          message: 'Invalid format. Example: filled.count.soap',
          loading: false,
          words: null,
          lat: null,
          lon: null,
          country: null,
          nearestPlace: null,
          language: null,
          apiError: null,
        };
        return;
      }
      snapshot.value = {
        ok: false,
        loading: true,
        message: 'Converting...',
        words: null,
        lat: null,
        lon: null,
        country: null,
        nearestPlace: null,
        language: null,
        apiError: null,
      };
      snapshot.value = await convertToCoordinates(words, apiKey.value);
    }
  }

  // Auto-execute with debounce when inputs change
  watch([mode, apiKey, latInput, lonInput, wordsInput, language], () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Only auto-execute if we have enough info
      if (mode.value === 'encode' && latInput.value && lonInput.value && apiKey.value) {
        execute();
      } else if (mode.value === 'decode' && wordsInput.value && apiKey.value) {
        execute();
      }
    }, 600);
  });

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.mode === 'string') {
        mode.value = p.mode === 'decode' ? 'decode' : 'encode';
      }
      if (typeof p.apiKey === 'string') apiKey.value = p.apiKey;
      if (typeof p.lat === 'string' || typeof p.lat === 'number') latInput.value = String(p.lat);
      if (typeof p.lon === 'string' || typeof p.lon === 'number') lonInput.value = String(p.lon);
      if (typeof p.words === 'string') wordsInput.value = p.words;
      if (typeof p.language === 'string') language.value = p.language;
    },
    output: snapshot,
    toOutput: () => ({ ...(snapshot.value ?? {}) }),
  });

  return {
    mode,
    apiKey,
    latInput,
    lonInput,
    wordsInput,
    language,
    snapshot,
    isEmbed,
    embedInput,
    reset,
    execute,
  };
}
