/**
 * Backend tool registry - minimal metadata for the `/api/tools` endpoint.
 *
 * The authoritative full registry (86 tools) currently lives in the
 * frontend (`packages/frontend/src/data/tools.ts`). In M0.4 the
 * `ToolMetadata` type and the full registry move to `@q-tools/shared`,
 * at which point both frontend and backend import from there and this
 * file is replaced by a re-export.
 *
 * For M0.3 we expose a representative subset (one or two tools per
 * category) so the `/api/tools` endpoint returns real data without
 * duplicating the entire 86-tool list.
 */
import type { ToolMetadata } from '@q-tools/shared';

export const TOOLS: ToolMetadata[] = [
  {
    slug: 'token-generator',
    name: 'Token generator',
    description: 'Generate cryptographically secure random tokens.',
    category: 'crypto',
    icon: 'key-round',
    keywords: ['token', 'random', 'secure', 'password'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'hash-text',
    name: 'Hash text',
    description: 'Hash text with MD5, SHA-1, SHA-256, SHA-512, SHA3, Blake3.',
    category: 'crypto',
    icon: 'fingerprint',
    keywords: ['hash', 'md5', 'sha', 'digest'],
    dependencies: ['hash-wasm'],
    apiAccessible: true,
  },
  {
    slug: 'uuid-generator',
    name: 'UUIDs generator',
    description: 'Generate UUIDs v1, v3, v4, v5.',
    category: 'crypto',
    icon: 'fingerprint',
    keywords: ['uuid', 'guid'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'base64-string',
    name: 'Base64 string encoder/decoder',
    description: 'Encode and decode Base64 strings.',
    category: 'converter',
    icon: 'binary',
    keywords: ['base64', 'encode', 'decode'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'yaml-to-json',
    name: 'YAML to JSON',
    description: 'Convert YAML documents to JSON.',
    category: 'converter',
    icon: 'file-code',
    keywords: ['yaml', 'json', 'convert'],
    dependencies: ['yaml'],
    apiAccessible: true,
  },
  {
    slug: 'url-encode-decode',
    name: 'URL encode/decode',
    description: 'Encode and decode URL components.',
    category: 'web',
    icon: 'link',
    keywords: ['url', 'encode', 'decode', 'percent'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'jwt-parser',
    name: 'JWT parser',
    description: 'Decode and inspect JSON Web Tokens.',
    category: 'web',
    icon: 'key',
    keywords: ['jwt', 'token', 'json'],
    dependencies: [],
    apiAccessible: false,
  },
  {
    slug: 'qr-code-generator',
    name: 'QR Code generator',
    description: 'Generate QR codes from text or URLs.',
    category: 'media',
    icon: 'qr-code',
    keywords: ['qr', 'code', 'image'],
    dependencies: ['qrcode'],
    apiAccessible: false,
  },
  {
    slug: 'json-prettify',
    name: 'JSON prettify and format',
    description: 'Format and pretty-print JSON.',
    category: 'dev',
    icon: 'braces',
    keywords: ['json', 'format', 'prettify'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'ipv4-subnet-calculator',
    name: 'IPv4 subnet calculator',
    description: 'Calculate IPv4 subnet details from CIDR notation.',
    category: 'network',
    icon: 'network',
    keywords: ['ipv4', 'subnet', 'cidr', 'network'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'math-evaluator',
    name: 'Math evaluator',
    description: 'Safely evaluate mathematical expressions.',
    category: 'math',
    icon: 'calculator',
    keywords: ['math', 'expression', 'evaluate'],
    dependencies: ['expr-eval'],
    apiAccessible: true,
  },
  {
    slug: 'temperature-converter',
    name: 'Temperature converter',
    description: 'Convert between Celsius, Fahrenheit, and Kelvin.',
    category: 'measurement',
    icon: 'thermometer',
    keywords: ['temperature', 'celsius', 'fahrenheit', 'kelvin'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'lorem-ipsum-generator',
    name: 'Lorem ipsum generator',
    description: 'Generate Lorem Ipsum placeholder text.',
    category: 'text',
    icon: 'align-left',
    keywords: ['lorem', 'ipsum', 'placeholder', 'text'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'iban-validator',
    name: 'IBAN validator and parser',
    description: 'Validate and parse International Bank Account Numbers.',
    category: 'data',
    icon: 'landmark',
    keywords: ['iban', 'bank', 'validate'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'vin-decoder',
    name: 'VIN decoder',
    description: 'Decode Vehicle Identification Numbers into WMI, VDS, VIS, check digit, model year, and serial number.',
    category: 'data',
    icon: 'car',
    keywords: ['vin', 'vehicle', 'identification', 'number', 'decoder'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'swift-bic-validator',
    name: 'SWIFT/BIC validator',
    description: 'Validate SWIFT/BIC codes and parse into bank code, country, location, and branch code.',
    category: 'data',
    icon: 'building-2',
    keywords: ['swift', 'bic', 'validate', 'bank', 'code'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'ssn-validator',
    name: 'SSN validator',
    description: 'Validate US Social Security Numbers with area, group, and serial number rules.',
    category: 'data',
    icon: 'badge-check',
    keywords: ['ssn', 'social', 'security', 'number', 'validate'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'barcode-generator',
    name: 'Barcode generator',
    description: 'Generate CODE128, EAN-13, EAN-8, and UPC-A barcodes.',
    category: 'data',
    icon: 'barcode',
    keywords: ['barcode', 'code128', 'ean13', 'ean8', 'upca', 'generate'],
    dependencies: [],
    apiAccessible: true,
  },
  {
    slug: 'pdf-signature-checker',
    name: 'PDF signature checker',
    description: 'Check digital signatures in PDF files.',
    category: 'crypto',
    icon: 'file-check',
    keywords: ['pdf', 'signature', 'pkcs7', 'certificate'],
    dependencies: ['pdfjs-dist', 'node-forge'],
    apiAccessible: false,
  },
];

/**
 * Look up a tool by slug. Returns `undefined` if not found.
 */
export function findTool(slug: string): ToolMetadata | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
