/**
 * useLoremIpsum — composable + pure logic for the Lorem ipsum generator tool.
 *
 * Generates Lorem Ipsum placeholder text from a bundled word pool. Supports
 * configurable paragraph count, sentences per paragraph, words per sentence,
 * and an option to start the first paragraph with the canonical
 * "Lorem ipsum dolor sit amet, consectetur adipiscing elit." opening.
 *
 * All randomness uses `crypto.getRandomValues()` with rejection sampling
 * (no modulo bias). No external dependencies.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types — pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface LoremOptions {
  /** Number of paragraphs to generate (1-100). */
  paragraphs: number;
  /** Sentences per paragraph (1-20). */
  sentencesPerParagraph: number;
  /** Words per sentence (1-50). */
  wordsPerSentence: number;
  /** When true, the first sentence of the first paragraph is the canonical
   *  "Lorem ipsum dolor sit amet, consectetur adipiscing elit." opening. */
  startWithClassic: boolean;
}

/* -------------------------------------------------------------------------- */
/* Constants — bundled word pool (no external dependency)                      */
/* -------------------------------------------------------------------------- */

/**
 * The classic Lorem Ipsum word pool. This is the standard set of pseudo-Latin
 * words used by Lorem Ipsum generators, derived from Cicero's "de Finibus
 * Bonorum et Malorum" sections 1.10.32 and 1.10.33.
 */
export const WORD_POOL: readonly string[] = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'praesent', 'vitae',
  'turpis', 'aenean', 'vehicula', 'morbi', 'vestibulum', 'pulvinar', 'metus',
  'vivamus', 'euismod', 'quam', 'porttitor', 'luctus', 'curabitur', 'pretium',
  'phasellus', 'cras', 'fermentum', 'dignissim', 'suspendisse', 'potenti',
  'viverra', 'accumsan', 'facilisis', 'taciti', 'sociosqu', 'himenaeos',
  'ullamcorper', 'interdum', 'tincidunt', 'maecenas', 'pellentesque',
  'habitant', 'morbi', 'tristique', 'senectus', 'netus', 'malesuada', 'fames',
  'turpis', 'eget', 'tempus', 'placerat', 'nibh', 'venenatis', 'sagittis',
];

/** The canonical opening sentence used when `startWithClassic` is true. */
export const CLASSIC_OPENING =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/**
 * Clamp an integer into the inclusive range [min, max]. Non-finite or non-numeric
 * inputs fall back to `min`. Floats are truncated toward zero.
 */
export function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  const truncated = Math.trunc(n);
  return Math.min(max, Math.max(min, truncated));
}

/**
 * Generate a uniformly-distributed random integer in [0, max) using
 * `crypto.getRandomValues()` with rejection sampling (no modulo bias).
 * Falls back to `Math.random()` in non-secure contexts so the tool still
 * functions (e.g. when served over HTTP on localhost).
 */
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  // Fast path for the common secure-context case.
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  ) {
    // Rejection sampling: discard values that would introduce modulo bias.
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    // Bounded retries — practically always resolves on the first draw.
    for (let i = 0; i < 32; i++) {
      globalThis.crypto.getRandomValues(buf);
      const r = buf[0] ?? 0;
      if (r < limit) return r % max;
    }
    // Extremely unlikely fallback after 32 tries.
    return Math.floor(Math.random() * max);
  }
  return Math.floor(Math.random() * max);
}

/** Pick a random word from the pool. */
export function pickWord(): string {
  return WORD_POOL[randomInt(WORD_POOL.length)] ?? 'lorem';
}

/**
 * Generate a single sentence of approximately `wordsPerSentence` words.
 * The first letter is capitalised and the sentence ends with a period.
 */
export function generateSentence(wordsPerSentence: number): string {
  const count = clampInt(wordsPerSentence, 1, 50);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) parts.push(pickWord());
  let sentence = parts.join(' ');
  // Capitalise the first letter.
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return `${sentence}.`;
}

/**
 * Generate a single paragraph composed of `sentencesPerParagraph` sentences,
 * each with `wordsPerSentence` words. When `startWithClassic` is true the
 * first sentence of the paragraph is the canonical Lorem Ipsum opening.
 */
export function generateParagraph(
  sentencesPerParagraph: number,
  wordsPerSentence: number,
  startWithClassic: boolean,
): string {
  const count = clampInt(sentencesPerParagraph, 1, 20);
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    if (startWithClassic && i === 0) {
      sentences.push(CLASSIC_OPENING);
    } else {
      sentences.push(generateSentence(wordsPerSentence));
    }
  }
  return sentences.join(' ');
}

/**
 * Generate the full Lorem Ipsum text: `paragraphs` paragraphs separated by a
 * blank line. Only the very first paragraph honours `startWithClassic`.
 */
export function generateLorem(options: LoremOptions): string {
  const paragraphs = clampInt(options.paragraphs, 1, 100);
  const sentencesPerParagraph = clampInt(options.sentencesPerParagraph, 1, 20);
  const wordsPerSentence = clampInt(options.wordsPerSentence, 1, 50);
  const startWithClassic = Boolean(options.startWithClassic);

  const out: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    out.push(
      generateParagraph(
        sentencesPerParagraph,
        wordsPerSentence,
        startWithClassic && p === 0,
      ),
    );
  }
  return out.join('\n\n');
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseLoremIpsumReturn {
  paragraphs: Ref<number>;
  sentencesPerParagraph: Ref<number>;
  wordsPerSentence: Ref<number>;
  startWithClassic: Ref<boolean>;
  output: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  generate: () => void;
  reset: () => void;
}

export function useLoremIpsum(): UseLoremIpsumReturn {
  const paragraphs = ref<number>(3);
  const sentencesPerParagraph = ref<number>(5);
  const wordsPerSentence = ref<number>(12);
  const startWithClassic = ref<boolean>(true);
  const output = ref<string>('');

  function generate(): void {
    output.value = generateLorem({
      paragraphs: paragraphs.value,
      sentencesPerParagraph: sentencesPerParagraph.value,
      wordsPerSentence: wordsPerSentence.value,
      startWithClassic: startWithClassic.value,
    });
  }

  function reset(): void {
    paragraphs.value = 3;
    sentencesPerParagraph.value = 5;
    wordsPerSentence.value = 12;
    startWithClassic.value = true;
    generate();
  }

  // Recompute whenever any option changes.
  watch(
    [paragraphs, sentencesPerParagraph, wordsPerSentence, startWithClassic],
    () => {
      generate();
    },
  );

  // Seed an initial output.
  generate();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (p.paragraphs !== undefined) paragraphs.value = clampInt(p.paragraphs, 1, 100);
      if (p.sentences !== undefined) sentencesPerParagraph.value = clampInt(p.sentences, 1, 20);
      if (p.sentencesPerParagraph !== undefined) sentencesPerParagraph.value = clampInt(p.sentencesPerParagraph, 1, 20);
      if (p.words !== undefined) wordsPerSentence.value = clampInt(p.words, 1, 50);
      if (p.wordsPerSentence !== undefined) wordsPerSentence.value = clampInt(p.wordsPerSentence, 1, 50);
      if (typeof p.startWithClassic === 'boolean') startWithClassic.value = p.startWithClassic;
      if (typeof p.classic === 'boolean') startWithClassic.value = p.classic;
      // Action verbs: regenerate on demand.
      const action =
        typeof p.action === 'string' ? p.action :
        typeof p.generate === 'string' ? p.generate : null;
      if (action === 'generate' || action === 'run' || p.generate === true) {
        generate();
      } else if (action === 'reset') {
        reset();
      }
    },
  });

  watch(output, () => {
    if (!isEmbed.value) return;
    sendOutput({
      output: output.value,
      paragraphs: paragraphs.value,
      sentencesPerParagraph: sentencesPerParagraph.value,
      wordsPerSentence: wordsPerSentence.value,
      startWithClassic: startWithClassic.value,
    });
  });

  return {
    paragraphs,
    sentencesPerParagraph,
    wordsPerSentence,
    startWithClassic,
    output,
    isEmbed,
    embedInput,
    generate,
    reset,
  };
}
