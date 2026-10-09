/**
 * useLogFormatter - composable + pure logic for parsing and prettifying common
 * log formats.
 *
 * Supports: Nginx access logs, Apache combined logs, syslog, JSON logs.
 * Auto-detects format or allows manual selection.
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type LogFormat = 'auto' | 'nginx' | 'apache' | 'syslog' | 'json';

export interface ParsedLogEntry {
  raw: string;
  fields: Record<string, string>;
  format: LogFormat;
}

export interface LogParseResult {
  entries: ParsedLogEntry[];
  detectedFormat: LogFormat;
  errors: string[];
}

/* -------------------------------------------------------------------------- */
/* Pure logic - parsers                                                        */
/* -------------------------------------------------------------------------- */

const NGINX_REGEX =
  /^(\S+) \S+ (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)"$/;
const APACHE_REGEX =
  /^(\S+) \S+ (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\S+) "([^"]*)" "([^"]*)"$/;
const SYSLOG_REGEX =
  /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}) (\S+) (\S+?)(?:\[(\d+)\])?: (.*)$/;

export function detectLogFormat(line: string): LogFormat {
  const trimmed = line.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return 'json';
  if (NGINX_REGEX.test(trimmed)) return 'nginx';
  if (APACHE_REGEX.test(trimmed)) return 'apache';
  if (SYSLOG_REGEX.test(trimmed)) return 'syslog';
  return 'auto';
}

export function parseNginxLine(line: string): Record<string, string> | null {
  const m = NGINX_REGEX.exec(line.trim());
  if (!m) return null;
  return {
    ip: m[1] ?? '',
    user: m[2] ?? '',
    timestamp: m[3] ?? '',
    method: m[4] ?? '',
    path: m[5] ?? '',
    protocol: m[6] ?? '',
    status: m[7] ?? '',
    size: m[8] ?? '',
    referer: m[9] ?? '',
    userAgent: m[10] ?? '',
  };
}

export function parseApacheLine(line: string): Record<string, string> | null {
  const m = APACHE_REGEX.exec(line.trim());
  if (!m) return null;
  return {
    ip: m[1] ?? '',
    user: m[2] ?? '',
    timestamp: m[3] ?? '',
    method: m[4] ?? '',
    path: m[5] ?? '',
    protocol: m[6] ?? '',
    status: m[7] ?? '',
    size: m[8] ?? '',
    referer: m[9] ?? '',
    userAgent: m[10] ?? '',
  };
}

export function parseSyslogLine(line: string): Record<string, string> | null {
  const m = SYSLOG_REGEX.exec(line.trim());
  if (!m) return null;
  return {
    timestamp: m[1] ?? '',
    host: m[2] ?? '',
    process: m[3] ?? '',
    pid: m[4] ?? '',
    message: m[5] ?? '',
  };
}

export function parseJsonLine(line: string): Record<string, string> | null {
  try {
    const obj = JSON.parse(line.trim());
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return out;
  } catch {
    return null;
  }
}

export function parseLog(text: string, format: LogFormat = 'auto'): LogParseResult {
  const lines = text.split('\n').filter((l) => l.trim());
  const entries: ParsedLogEntry[] = [];
  const errors: string[] = [];
  let detected: LogFormat = format;

  if (format === 'auto' && lines.length > 0) {
    detected = detectLogFormat(lines[0] ?? '');
    if (detected === 'auto') detected = 'nginx';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let fields: Record<string, string> | null = null;
    let fmt: LogFormat = detected;

    if (detected === 'nginx') {
      fields = parseNginxLine(line);
    } else if (detected === 'apache') {
      fields = parseApacheLine(line);
    } else if (detected === 'syslog') {
      fields = parseSyslogLine(line);
    } else if (detected === 'json') {
      fields = parseJsonLine(line);
      fmt = 'json';
    }

    if (!fields) {
      errors.push(`Line ${i + 1}: could not parse as ${detected}`);
      entries.push({ raw: line, fields: {}, format: detected });
    } else {
      entries.push({ raw: line, fields, format: fmt });
    }
  }

  return { entries, detectedFormat: detected, errors };
}

export function formatParsedLog(result: LogParseResult): string {
  if (result.entries.length === 0) return '';

  const lines: string[] = [];
  for (const entry of result.entries) {
    if (Object.keys(entry.fields).length === 0) {
      lines.push(entry.raw);
      continue;
    }

    if (result.detectedFormat === 'json') {
      lines.push(JSON.stringify(entry.fields, null, 2));
    } else {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(entry.fields)) {
        parts.push(`${k}=${v}`);
      }
      lines.push(parts.join('  '));
    }
  }
  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseLogFormatterReturn {
  input: Ref<string>;
  format: Ref<LogFormat>;
  output: ComputedRef<string>;
  detectedFormat: ComputedRef<LogFormat>;
  errors: ComputedRef<string[]>;
  entryCount: ComputedRef<number>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useLogFormatter(): UseLogFormatterReturn {
  const input = ref<string>('');
  const format = ref<LogFormat>('auto');

  const parseResult = computed(() => {
    if (!input.value.trim()) return null;
    return parseLog(input.value, format.value);
  });

  const output = computed(() => {
    if (!parseResult.value) return '';
    return formatParsedLog(parseResult.value);
  });

  const detectedFormat = computed(() => parseResult.value?.detectedFormat ?? format.value);
  const errors = computed(() => parseResult.value?.errors ?? []);
  const entryCount = computed(() => parseResult.value?.entries.length ?? 0);

  function reset(): void {
    input.value = '';
    format.value = 'auto';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      }
      if (typeof p.format === 'string') {
        format.value = p.format as LogFormat;
      }
    },
    output,
    toOutput: () => ({
      format: detectedFormat.value,
      output: output.value,
      entryCount: entryCount.value,
    }),
  });

  return {
    input,
    format,
    output,
    detectedFormat,
    errors,
    entryCount,
    isEmbed,
    embedInput,
    reset,
  };
}
