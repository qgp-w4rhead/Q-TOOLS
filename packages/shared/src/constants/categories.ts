/**
 * Tool category definitions - shared between frontend and backend.
 *
 * The categories match the `ToolCategory` union in `../types/tool.ts`.
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
    icon: 'lock',
    description: 'Hashing, encryption, keys, and password tools.',
  },
  {
    id: 'converter',
    label: 'Converter',
    icon: 'arrow-left-right',
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
    description: 'Phone numbers, IBAN, VIN, SSN, credit cards, ISBN, SWIFT/BIC, and barcodes.',
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: 'eye-off',
    description: 'PII redaction, security headers, breach checks, CSP analysis, and certificate decoding.',
  },
  {
    id: 'cipher',
    label: 'Classical Ciphers',
    icon: 'key-round',
    description: 'Historical and educational cipher tools - Caesar, Vigenère, Atbash, Morse, and more.',
  },
  {
    id: 'devops',
    label: 'DevOps & Infrastructure',
    icon: 'terminal',
    description: 'Nginx, systemd, Kubernetes, DNS, Dockerfile, cron, and port-forwarding utilities.',
  },
  {
    id: 'api',
    label: 'API & Testing',
    icon: 'webhook',
    description: 'HTTP request building, API development, mock utilities, and schema validation.',
  },
  {
    id: 'i18n',
    label: 'Internationalization',
    icon: 'languages',
    description: 'ICU MessageFormat, locale formatting, plural rules, language/currency/country codes, and Unicode utilities.',
  },
  {
    id: 'finance',
    label: 'Finance & Calculators',
    icon: 'banknote',
    description: 'Loan, compound interest, currency, VAT, income tax, invoice, ROI, depreciation, and break-even calculators.',
  },
  {
    id: 'geo',
    label: 'Geographic & Coordinates',
    icon: 'map-pin',
    description: 'Coordinate conversion, geohash, Plus Code, distance, timezone, bounding box, and what3words utilities.',
  },
  {
    id: 'a11y',
    label: 'Accessibility',
    icon: 'accessibility',
    description: 'Color contrast, ARIA labels, alt text, tab order, WCAG reference, heading structure, focus indicators, and screen reader text.',
  },
  {
    id: 'av',
    label: 'Audio & Video',
    icon: 'clapperboard',
    description: 'Audio and video conversion, transcoding, trimming, merging, and metadata utilities.',
  },
];

/** Look up a category definition by id. Returns `undefined` if not found. */
export function getCategoryById(id: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
