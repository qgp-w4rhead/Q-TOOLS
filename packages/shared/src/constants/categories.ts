/**
 * Tool category definitions — shared between frontend and backend.
 *
 * The 10 categories match the `ToolCategory` union in `../types/tool.ts`.
 * Each category has an id (used in tool metadata), a human-readable label,
 * a lucide-vue-next icon name, and a short description.
 */
import type { ToolCategory } from '../types/tool.js';

export interface CategoryDefinition {
  id: ToolCategory;
  label: string;
  /** lucide-vue-next icon name (kebab-case, matched in the icon map). */
  icon: string;
  description: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: 'crypto',
    label: 'Crypto',
    icon: 'shield',
    description: 'Hashing, encryption, keys, and password tools.',
  },
  {
    id: 'converter',
    label: 'Converter',
    icon: 'repeat',
    description: 'Convert between data formats, encodings, and units.',
  },
  {
    id: 'web',
    label: 'Web',
    icon: 'globe',
    description: 'URL, HTTP, JWT, and browser-related utilities.',
  },
  {
    id: 'media',
    label: 'Images & Videos',
    icon: 'image',
    description: 'QR codes, SVG placeholders, and camera recording.',
  },
  {
    id: 'dev',
    label: 'Development',
    icon: 'code',
    description: 'Git, Docker, JSON, SQL, regex, and dev cheatsheets.',
  },
  {
    id: 'network',
    label: 'Network',
    icon: 'network',
    description: 'IP, subnet, MAC, and IPv6 utilities.',
  },
  {
    id: 'math',
    label: 'Math',
    icon: 'calculator',
    description: 'Evaluators and calculators.',
  },
  {
    id: 'measurement',
    label: 'Measurement',
    icon: 'ruler',
    description: 'Timers, temperature, and benchmarks.',
  },
  {
    id: 'text',
    label: 'Text',
    icon: 'type',
    description: 'Generators, statistics, diffs, and obfuscation.',
  },
  {
    id: 'data',
    label: 'Data',
    icon: 'database',
    description: 'Phone numbers and IBAN validation.',
  },
];

/** Look up a category definition by id. Returns `undefined` if not found. */
export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
