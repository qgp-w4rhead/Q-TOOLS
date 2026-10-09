/**
 * useBarcodeGenerator - composable + pure logic for the barcode generator.
 *
 * Generates CODE128, EAN-13, EAN-8, and UPC-A barcodes. Encodes the
 * barcode into bar/space width arrays for SVG rendering.
 *
 * No external dependencies - pure logic only.
 */
import { ref, watch, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type BarcodeType = 'code128' | 'ean13' | 'ean8' | 'upca';

export interface BarcodeEncodeResult {
  valid: boolean;
  bars: number[];
  text: string;
  errors: string[];
}

export interface UseBarcodeGeneratorReturn {
  input: Ref<string>;
  type: Ref<BarcodeType>;
  result: Ref<BarcodeEncodeResult | null>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* CODE128 - full ASCII support (Code B subset)                                */
/* -------------------------------------------------------------------------- */

/** CODE128 value → 6-element bar/space pattern (each element = module width). */
const CODE128_TABLE = [
  '212222','222122','222221','121223','121322','131222','122213',
  '122312','132212','221213','221312','231212','112232','122132',
  '122231','113222','133122','123221','221132','221231','213212',
  '223112','312131','311222','321122','321221','312212','322112',
  '322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133',
  '112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','233113','213131','311123','311321','331121',
  '312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412',
  '122114','122411','142112','142211','241211','221114','413111',
  '241112','134111','111242','121142','121241','114212','124112',
  '124211','411212','421112','421211','212141','214121','412121',
  '111143','111341','131141','114113','114311','411113','411311',
  '113141','114131','311141','411131',
];

/** CODE128 start code B (printable ASCII). */
const CODE128_START_B = 104;

function encodeCode128(text: string): BarcodeEncodeResult {
  const errors: string[] = [];

  if (text.length === 0) {
    return { valid: false, bars: [], text: '', errors: [] };
  }

  // Use Code B for printable ASCII (32-127), fall back to Code A for control chars
  const values: number[] = [CODE128_START_B];

  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 127) {
      values.push(code - 32);
    } else if (code >= 0 && code < 32) {
      // Switch to Code A for control characters
      values.push(101); // FNC4 / shift
      values.push(code + 64);
    } else {
      errors.push(`Character "${ch}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) is not supported in CODE128.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, bars: [], text, errors };
  }

  // Compute checksum
  let checksum = values[0]!;
  for (let i = 1; i < values.length; i++) {
    checksum += values[i]! * i;
  }
  checksum %= 103;
  values.push(checksum);

  // Encode to bars
  const bars: number[] = [];
  for (const v of values) {
    const pattern = CODE128_TABLE[v] ?? '';
    for (let j = 0; j < 6; j++) {
      bars.push(parseInt(pattern[j] ?? '0', 10));
    }
  }

  // Stop code: 2-3-3-1-1-1 + 2 (termination bar)
  const stopPattern = '2331112';
  for (let j = 0; j < 7; j++) {
    bars.push(parseInt(stopPattern[j] ?? '0', 10));
  }

  return { valid: true, bars, text, errors: [] };
}

/* -------------------------------------------------------------------------- */
/* EAN-13 / EAN-8 / UPC-A                                                      */
/* -------------------------------------------------------------------------- */

/** Left-hand odd parity (A) patterns for digits 0-9. */
const EAN_LEFT_ODD = [
  '0001101','0011001','0010011','0111101','0100011',
  '0110001','0101111','0111011','0110111','0001011',
];

/** Left-hand even parity (B) patterns for digits 0-9. */
const EAN_LEFT_EVEN = [
  '0100111','0110011','0011011','0100001','0011101',
  '0111001','0000101','0010001','0001001','0010111',
];

/** Right-hand (C) patterns for digits 0-9. */
const EAN_RIGHT = [
  '1110010','1100110','1101100','1000010','1011100',
  '1001110','1010000','1000100','1001000','1110100',
];

/** Parity patterns for EAN-13 (first digit → A/B pattern for digits 2-7). */
const EAN13_PARITY = [
  'AAAAAA','AABABB','AABBAB','AABBBA','ABAABB',
  'ABBAAB','ABBBAA','ABABAB','ABABBA','ABBABA',
];

/** Compute EAN/UPC check digit. */
function computeEanCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i]!, 10);
    // Weight alternates: 3 for even positions (0-indexed from right), 1 for odd
    // For EAN-13: positions 1,3,5,7,9,11 (0-indexed: 0,2,4,6,8,10) get weight 1
    //             positions 2,4,6,8,10,12 (0-indexed: 1,3,5,7,9,11) get weight 3
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** Compute UPC-A check digit (different weighting: odd positions get 3). */
function computeUpcaCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i]!, 10);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

function encodeEan13(rawInput: string): BarcodeEncodeResult {
  const digits = rawInput.replace(/\D/g, '');
  const errors: string[] = [];

  if (digits.length === 0) {
    return { valid: false, bars: [], text: '', errors: [] };
  }

  let dataDigits: string;

  if (digits.length === 12) {
    // No check digit provided - compute it
    dataDigits = digits;
  } else if (digits.length === 13) {
    // Check digit provided - verify it
    dataDigits = digits.slice(0, 12);
    const providedCheck = parseInt(digits[12]!, 10);
    const computedCheck = computeEanCheckDigit(dataDigits);
    if (providedCheck !== computedCheck) {
      errors.push(`Check digit mismatch: expected ${computedCheck}, got ${providedCheck}.`);
    }
  } else {
    errors.push(`EAN-13 requires 12 or 13 digits (got ${digits.length}).`);
    return { valid: false, bars: [], text: digits, errors };
  }

  if (errors.length > 0) {
    return { valid: false, bars: [], text: digits, errors };
  }

  const checkDigit = computeEanCheckDigit(dataDigits);
  const fullDigits = dataDigits + String(checkDigit);
  const firstDigit = parseInt(dataDigits[0]!, 10);
  const parity = EAN13_PARITY[firstDigit] ?? 'AAAAAA';

  const bars: number[] = [];

  // Start guard: bar-space-bar (1-1-1)
  bars.push(1, 1, 1);

  // Left side: digits 2-7 (indices 1-6)
  for (let i = 0; i < 6; i++) {
    const d = parseInt(dataDigits[i + 1]!, 10);
    const useEven = parity[i] === 'B';
    const pattern = useEven ? EAN_LEFT_EVEN[d] : EAN_LEFT_ODD[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // Center guard: space-bar-space-bar-space (1-1-1-1-1)
  bars.push(1, 1, 1, 1, 1);

  // Right side: digits 8-13 (indices 7-12)
  for (let i = 0; i < 6; i++) {
    const d = parseInt(fullDigits[i + 7]!, 10);
    const pattern = EAN_RIGHT[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // End guard: bar-space-bar (1-1-1)
  bars.push(1, 1, 1);

  return { valid: true, bars, text: fullDigits, errors: [] };
}

function encodeEan8(rawInput: string): BarcodeEncodeResult {
  const digits = rawInput.replace(/\D/g, '');
  const errors: string[] = [];

  if (digits.length === 0) {
    return { valid: false, bars: [], text: '', errors: [] };
  }

  let dataDigits: string;

  if (digits.length === 7) {
    dataDigits = digits;
  } else if (digits.length === 8) {
    dataDigits = digits.slice(0, 7);
    const providedCheck = parseInt(digits[7]!, 10);
    const computedCheck = computeEanCheckDigit(dataDigits);
    if (providedCheck !== computedCheck) {
      errors.push(`Check digit mismatch: expected ${computedCheck}, got ${providedCheck}.`);
    }
  } else {
    errors.push(`EAN-8 requires 7 or 8 digits (got ${digits.length}).`);
    return { valid: false, bars: [], text: digits, errors };
  }

  if (errors.length > 0) {
    return { valid: false, bars: [], text: digits, errors };
  }

  const checkDigit = computeEanCheckDigit(dataDigits);
  const fullDigits = dataDigits + String(checkDigit);

  const bars: number[] = [];

  // Start guard
  bars.push(1, 1, 1);

  // Left side: digits 1-4 (odd parity)
  for (let i = 0; i < 4; i++) {
    const d = parseInt(dataDigits[i]!, 10);
    const pattern = EAN_LEFT_ODD[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // Center guard
  bars.push(1, 1, 1, 1, 1);

  // Right side: digits 5-8
  for (let i = 0; i < 4; i++) {
    const d = parseInt(fullDigits[i + 4]!, 10);
    const pattern = EAN_RIGHT[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // End guard
  bars.push(1, 1, 1);

  return { valid: true, bars, text: fullDigits, errors: [] };
}

function encodeUpca(rawInput: string): BarcodeEncodeResult {
  const digits = rawInput.replace(/\D/g, '');
  const errors: string[] = [];

  if (digits.length === 0) {
    return { valid: false, bars: [], text: '', errors: [] };
  }

  let dataDigits: string;

  if (digits.length === 11) {
    dataDigits = digits;
  } else if (digits.length === 12) {
    dataDigits = digits.slice(0, 11);
    const providedCheck = parseInt(digits[11]!, 10);
    const computedCheck = computeUpcaCheckDigit(dataDigits);
    if (providedCheck !== computedCheck) {
      errors.push(`Check digit mismatch: expected ${computedCheck}, got ${providedCheck}.`);
    }
  } else {
    errors.push(`UPC-A requires 11 or 12 digits (got ${digits.length}).`);
    return { valid: false, bars: [], text: digits, errors };
  }

  if (errors.length > 0) {
    return { valid: false, bars: [], text: digits, errors };
  }

  const checkDigit = computeUpcaCheckDigit(dataDigits);
  const fullDigits = dataDigits + String(checkDigit);

  const bars: number[] = [];

  // Start guard
  bars.push(1, 1, 1);

  // Left side: digits 1-6 (odd parity)
  for (let i = 0; i < 6; i++) {
    const d = parseInt(dataDigits[i]!, 10);
    const pattern = EAN_LEFT_ODD[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // Center guard
  bars.push(1, 1, 1, 1, 1);

  // Right side: digits 7-12
  for (let i = 0; i < 6; i++) {
    const d = parseInt(fullDigits[i + 6]!, 10);
    const pattern = EAN_RIGHT[d];
    for (let j = 0; j < 7; j++) {
      bars.push(parseInt(pattern![j]!, 10));
    }
  }

  // End guard
  bars.push(1, 1, 1);

  return { valid: true, bars, text: fullDigits, errors: [] };
}

/** Encode a barcode based on the type. */
export function encodeBarcode(text: string, type: BarcodeType): BarcodeEncodeResult {
  switch (type) {
    case 'code128':
      return encodeCode128(text);
    case 'ean13':
      return encodeEan13(text);
    case 'ean8':
      return encodeEan8(text);
    case 'upca':
      return encodeUpca(text);
    default:
      return { valid: false, bars: [], text, errors: ['Unknown barcode type.'] };
  }
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useBarcodeGenerator(): UseBarcodeGeneratorReturn {
  const input = ref<string>('');
  const type = ref<BarcodeType>('code128');
  const result = ref<BarcodeEncodeResult | null>(null);

  function recompute(): void {
    const encoded = encodeBarcode(input.value, type.value);
    if (encoded.bars.length === 0 && encoded.errors.length === 0) {
      result.value = null;
      return;
    }
    result.value = encoded;
  }

  function reset(): void {
    input.value = '';
    type.value = 'code128';
    result.value = null;
  }

  watch([input, type], () => {
    recompute();
  });

  recompute();

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      }
      if (typeof p.type === 'string') {
        const validTypes: BarcodeType[] = ['code128', 'ean13', 'ean8', 'upca'];
        if (validTypes.includes(p.type as BarcodeType)) {
          type.value = p.type as BarcodeType;
        }
      }
    },
  });

  watch(result, () => {
    if (isEmbed.value && result.value) {
      sendOutput(result.value);
    }
  });

  return {
    input,
    type,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
