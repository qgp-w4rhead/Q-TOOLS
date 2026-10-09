/**
 * useAsciiArtTextGenerator - composable + pure logic for the ASCII Art Text
 * Generator tool.
 *
 * Renders text as ASCII art using the `figlet` package. The figlet core module
 * is lazy-loaded as its own Vite chunk (~5 KB); each font is loaded on demand
 * from `figlet/importable-fonts/<Name>.js` (default export = FLF font data
 * string) and registered via `figlet.parseFont(name, data)`. Loaded fonts are
 * cached for the lifetime of the page so subsequent renders are instant.
 *
 * A curated set of 26 popular fonts is offered via a dropdown + preview
 * gallery. Horizontal and vertical layout (kerning / smushing) modes are
 * configurable per figlet's `FigletOptions`.
 *
 * No external dependencies beyond `figlet` (lazy-loaded).
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** figlet kerning / smushing layout modes. */
export type KerningMethod =
  | 'default'
  | 'full'
  | 'fitted'
  | 'controlled smushing'
  | 'universal smushing';

export interface AsciiArtOptions {
  /** figlet font name. Must be one of `CURATED_FONTS` or already registered. */
  font: string;
  /** Horizontal layout / smushing mode. */
  horizontalLayout: KerningMethod;
  /** Vertical layout / smushing mode. */
  verticalLayout: KerningMethod;
}

export interface FontPreview {
  /** Font name. */
  name: string;
  /** Rendered ASCII art preview (may be empty string while loading/errored). */
  art: string;
  /** Whether the preview is currently loading. */
  loading: boolean;
  /** Error message if the preview failed to render. */
  error: string | null;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

/** Default font for new sessions. */
export const DEFAULT_FONT = 'Standard';

/** Default sample text shown in the gallery when the input is empty. */
export const DEFAULT_SAMPLE = 'Q-Tools';

/** Curated list of 26 popular figlet fonts offered in the UI. Each has a
 *  matching `figlet/importable-fonts/<Name>.js` module. */
export const CURATED_FONTS: readonly string[] = [
  'Standard',
  'Big',
  'Block',
  'Bubble',
  'Digital',
  'Ghost',
  'Mini',
  'Script',
  'Shadow',
  'Slant',
  'Small',
  'Speed',
  'ANSI Shadow',
  '3D-ASCII',
  'Alligator2',
  'Roman',
  'Cyberlarge',
  'Doom',
  'Elite',
  'Isometric1',
  'Letters',
  'Ogre',
  'Rectangles',
  'Star Wars',
  'Train',
  'Varsity',
];

/** All selectable kerning modes (used for both horizontal & vertical layout). */
export const KERNING_METHODS: readonly KerningMethod[] = [
  'default',
  'full',
  'fitted',
  'controlled smushing',
  'universal smushing',
];

/* -------------------------------------------------------------------------- */
/* Pure helpers - no Vue dependency below this point                           */
/* -------------------------------------------------------------------------- */

/**
 * Clamp an integer into the inclusive range [min, max]. Non-finite or
 * non-numeric inputs fall back to `min`. Floats are truncated toward zero.
 */
export function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  const truncated = Math.trunc(n);
  return Math.min(max, Math.max(min, truncated));
}

/**
 * Coerce an arbitrary value into a valid `KerningMethod`. Unknown strings
 * fall back to `defaultValue`.
 */
export function coerceKerning(
  value: unknown,
  defaultValue: KerningMethod = 'default',
): KerningMethod {
  if (typeof value === 'string') {
    return (KERNING_METHODS as readonly string[]).includes(value)
      ? (value as KerningMethod)
      : defaultValue;
  }
  return defaultValue;
}

/**
 * Coerce an arbitrary value into a known curated font name. Unknown strings
 * fall back to `defaultValue`. Matching is case-sensitive (figlet font names
 * are case-sensitive).
 */
export function coerceFont(
  value: unknown,
  defaultValue: string = DEFAULT_FONT,
): string {
  if (typeof value === 'string' && CURATED_FONTS.includes(value)) {
    return value;
  }
  return defaultValue;
}

/* -------------------------------------------------------------------------- */
/* figlet loader - lazy module + per-font dynamic imports                      */
/* -------------------------------------------------------------------------- */

/**
 * Minimal structural type for the figlet module surface we use. Avoids
 * importing the type from `figlet` at module top-level (which would pull the
 * package into the initial bundle).
 */
interface FigletModule {
  parseFont: (font: string, data: string, override?: boolean) => unknown;
  textSync: (text: string, options?: Record<string, unknown>) => string;
  loadedFonts: () => string[];
}

/** Cached figlet module promise. */
let figletPromise: Promise<FigletModule> | null = null;

/**
 * Lazy-load the figlet package (browser ESM build). Cached so the dynamic
 * import only fires once; Vite emits it as a separate chunk.
 */
export function loadFiglet(): Promise<FigletModule> {
  if (!figletPromise) {
    figletPromise = import('figlet').then(
      (mod): FigletModule => {
        // The browser ESM build exports the figlet object as default.
        const fn = (mod.default ?? mod) as FigletModule;
        if (!fn || typeof fn.textSync !== 'function') {
          throw new Error('figlet module did not expose textSync');
        }
        return fn;
      },
    );
  }
  return figletPromise;
}

/**
 * Reset the figlet module cache. Exposed for tests so a fresh module can be
 * injected via mocking. Not used in production.
 */
export function resetFigletCache(): void {
  figletPromise = null;
  registeredFonts.clear();
}

/** Map of font name → loader function (dynamic import of importable-font). */
const FONT_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  Standard: () => import('figlet/importable-fonts/Standard.js'),
  Big: () => import('figlet/importable-fonts/Big.js'),
  Block: () => import('figlet/importable-fonts/Block.js'),
  Bubble: () => import('figlet/importable-fonts/Bubble.js'),
  Digital: () => import('figlet/importable-fonts/Digital.js'),
  Ghost: () => import('figlet/importable-fonts/Ghost.js'),
  Mini: () => import('figlet/importable-fonts/Mini.js'),
  Script: () => import('figlet/importable-fonts/Script.js'),
  Shadow: () => import('figlet/importable-fonts/Shadow.js'),
  Slant: () => import('figlet/importable-fonts/Slant.js'),
  Small: () => import('figlet/importable-fonts/Small.js'),
  Speed: () => import('figlet/importable-fonts/Speed.js'),
  'ANSI Shadow': () => import('figlet/importable-fonts/ANSI Shadow.js'),
  '3D-ASCII': () => import('figlet/importable-fonts/3D-ASCII.js'),
  Alligator2: () => import('figlet/importable-fonts/Alligator2.js'),
  Roman: () => import('figlet/importable-fonts/Roman.js'),
  Cyberlarge: () => import('figlet/importable-fonts/Cyberlarge.js'),
  Doom: () => import('figlet/importable-fonts/Doom.js'),
  Elite: () => import('figlet/importable-fonts/Elite.js'),
  Isometric1: () => import('figlet/importable-fonts/Isometric1.js'),
  Letters: () => import('figlet/importable-fonts/Letters.js'),
  Ogre: () => import('figlet/importable-fonts/Ogre.js'),
  Rectangles: () => import('figlet/importable-fonts/Rectangles.js'),
  'Star Wars': () => import('figlet/importable-fonts/Star Wars.js'),
  Train: () => import('figlet/importable-fonts/Train.js'),
  Varsity: () => import('figlet/importable-fonts/Varsity.js'),
};

/** Set of font names already registered with the figlet module. */
const registeredFonts = new Set<string>();

/** In-flight font-load promises (avoids duplicate concurrent loads). */
const fontLoadPromises = new Map<string, Promise<void>>();

/**
 * Load + register a single font with the figlet module. Cached: once a font
 * is registered it is a no-op on subsequent calls. Concurrent calls for the
 * same font share the same in-flight promise.
 */
export async function loadFont(name: string): Promise<void> {
  if (registeredFonts.has(name)) return;
  const existing = fontLoadPromises.get(name);
  if (existing) return existing;

  const loader = FONT_LOADERS[name];
  if (!loader) {
    throw new Error(`Unknown figlet font: ${name}`);
  }

  const promise = (async () => {
    const figlet = await loadFiglet();
    const mod = await loader();
    const data = mod.default;
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error(`Font "${name}" shipped empty font data`);
    }
    figlet.parseFont(name, data);
    registeredFonts.add(name);
  })();

  fontLoadPromises.set(name, promise);
  try {
    await promise;
  } finally {
    fontLoadPromises.delete(name);
  }
}

/**
 * Render `text` as ASCII art with the given options. Loads figlet + the
 * requested font on demand (cached). Returns the rendered string.
 *
 * Throws on unknown fonts or figlet render errors - callers should catch and
 * surface a user-friendly message.
 */
export async function renderAsciiArt(
  text: string,
  options: AsciiArtOptions,
): Promise<string> {
  const figlet = await loadFiglet();
  await loadFont(options.font);
  return figlet.textSync(text, {
    font: options.font,
    horizontalLayout: options.horizontalLayout,
    verticalLayout: options.verticalLayout,
  });
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseAsciiArtTextGeneratorReturn {
  input: Ref<string>;
  font: Ref<string>;
  horizontalLayout: Ref<KerningMethod>;
  verticalLayout: Ref<KerningMethod>;
  output: Ref<string>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  gallery: Ref<FontPreview[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useAsciiArtTextGenerator(): UseAsciiArtTextGeneratorReturn {
  const input = ref<string>('');
  const font = ref<string>(DEFAULT_FONT);
  const horizontalLayout = ref<KerningMethod>('default');
  const verticalLayout = ref<KerningMethod>('default');
  const output = ref<string>('');
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const gallery = ref<FontPreview[]>(
    CURATED_FONTS.map((name) => ({
      name,
      art: '',
      loading: false,
      error: null,
    })),
  );

  /** Stale-token guard: only the most recent recompute may write output. */
  let renderToken = 0;

  async function recompute(): Promise<void> {
    const token = ++renderToken;
    const text = input.value;
    const opts: AsciiArtOptions = {
      font: font.value,
      horizontalLayout: horizontalLayout.value,
      verticalLayout: verticalLayout.value,
    };

    if (text.length === 0) {
      output.value = '';
      error.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      const art = await renderAsciiArt(text, opts);
      if (token === renderToken) {
        output.value = art;
        loading.value = false;
      }
    } catch (err) {
      if (token === renderToken) {
        error.value = err instanceof Error ? err.message : String(err);
        output.value = '';
        loading.value = false;
      }
    }
  }

  /** Refresh the font preview gallery for the current input (or default
   *  sample when the input is empty). Each font renders independently; a
   *  failure in one font does not block the others. */
  async function refreshGallery(): Promise<void> {
    const sample = input.value.length > 0 ? input.value : DEFAULT_SAMPLE;
    // Snapshot the current gallery so each font updates independently.
    const names = CURATED_FONTS.slice();
    // Mark all as loading.
    gallery.value = names.map((name) => ({
      name,
      art: '',
      loading: true,
      error: null,
    }));
    await Promise.all(
      names.map(async (name, idx) => {
        try {
          const art = await renderAsciiArt(sample, {
            font: name,
            horizontalLayout: 'default',
            verticalLayout: 'default',
          });
          // Only update if the gallery hasn't been replaced by a newer refresh.
          if (gallery.value[idx]?.name === name) {
            gallery.value[idx] = {
              name,
              art,
              loading: false,
              error: null,
            };
          }
        } catch (err) {
          if (gallery.value[idx]?.name === name) {
            gallery.value[idx] = {
              name,
              art: '',
              loading: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      }),
    );
  }

  function reset(): void {
    input.value = '';
    font.value = DEFAULT_FONT;
    horizontalLayout.value = 'default';
    verticalLayout.value = 'default';
    output.value = '';
    error.value = null;
    loading.value = false;
    renderToken++;
    void refreshGallery();
  }

  // Debounce the recompute so typing stays responsive.
  let recomputeTimer: ReturnType<typeof setTimeout> | null = null;
  let galleryTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleRecompute(): void {
    if (recomputeTimer) clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(() => {
      void recompute();
    }, 150);
  }

  function scheduleGallery(): void {
    if (galleryTimer) clearTimeout(galleryTimer);
    galleryTimer = setTimeout(() => {
      void refreshGallery();
    }, 250);
  }

  watch([input, font, horizontalLayout, verticalLayout], () => {
    scheduleRecompute();
  });

  // Gallery refreshes when the input changes (debounced longer so typing
  // doesn't thrash 26 concurrent renders). Font/layout changes do not affect
  // the gallery (it always uses default layout).
  watch(input, () => {
    scheduleGallery();
  });

  // Seed an initial gallery render with the default sample.
  void refreshGallery();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.text === 'string') input.value = p.text;
      else if (typeof p.input === 'string') input.value = p.input;
      else if (typeof p.value === 'string') input.value = p.value;
      else if (typeof p.content === 'string') input.value = p.content;
      if (p.font !== undefined) font.value = coerceFont(p.font, font.value);
      if (p.horizontalLayout !== undefined) {
        horizontalLayout.value = coerceKerning(p.horizontalLayout);
      }
      if (p.verticalLayout !== undefined) {
        verticalLayout.value = coerceKerning(p.verticalLayout);
      }
      const action = typeof p.action === 'string' ? p.action : null;
      if (action === 'reset' || action === 'clear') reset();
    },
  });

  watch([output, font, horizontalLayout, verticalLayout, loading, error], () => {
    if (!isEmbed.value) return;
    sendOutput({
      output: output.value,
      font: font.value,
      horizontalLayout: horizontalLayout.value,
      verticalLayout: verticalLayout.value,
      loading: loading.value,
      error: error.value,
    });
  });

  return {
    input,
    font,
    horizontalLayout,
    verticalLayout,
    output,
    loading,
    error,
    gallery,
    isEmbed,
    embedInput,
    reset,
  };
}
