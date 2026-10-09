/**
 * useDockerRunToCompose - composable + pure logic for the Docker run →
 * Docker Compose converter tool.
 *
 * Parses one or more `docker run` command strings (typically pasted from a
 * shell script or docs) and emits a `docker-compose.yml` whose `services:`
 * map contains one service per `docker run` invocation.
 *
 * The parser is a hand-rolled shell-like tokenizer + flag walker - no
 * external shell parsing library. The structured `ComposeFile` object is
 * serialised to YAML with the `yaml` package (part of the initial bundle
 * per `tech-stack.md`, so no new dependency is introduced).
 *
 * Pure helpers (`tokenize`, `splitSegments`, `parseDockerRun`,
 * `buildComposeFile`, `composeFileToYaml`, `deriveServiceName`) have no Vue
 * dependency and can be imported standalone for unit testing or reuse. The
 * `useDockerRunToCompose()` composable wraps them in reactive state and
 * wires up the embed PostMessage protocol.
 *
 * Dependencies: `yaml` (initial bundle, listed in tech-stack.md).
 */
import { ref, watch, type Ref } from 'vue';
import { stringify as yamlStringify } from 'yaml';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

/** A single docker-compose service definition (only spec'd keys emitted). */
export interface ComposeService {
  image?: string;
  container_name?: string;
  hostname?: string;
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string | null>;
  env_file?: string[];
  networks?: string[];
  restart?: string;
  labels?: Record<string, string>;
  user?: string;
  working_dir?: string;
  entrypoint?: string | string[];
  command?: string[];
}

/** Top-level compose file object (`{ services: { name: service } }`). */
export interface ComposeFile {
  services: Record<string, ComposeService>;
}

/** Result of parsing a single `docker run` segment. */
export interface ParsedService {
  /** Derived service name (sanitised, unique within the file). */
  name: string;
  service: ComposeService;
  /** Non-fatal notices about unsupported / unrecognised flags. */
  warnings: string[];
}

/** Result of parsing the whole input (one or more docker run commands). */
export interface ParseResult {
  ok: boolean;
  /** When `ok` is false, a human-readable error message. */
  error: string;
  /** Parsed services (empty when `ok` is false). */
  services: ParsedService[];
  /** Aggregated warnings from every segment. */
  warnings: string[];
}

/** Final conversion output. */
export interface ConvertResult {
  /** `docker-compose.yml` YAML text. */
  yaml: string;
  /** Number of services emitted. */
  serviceCount: number;
  /** Aggregated warnings (empty when all flags were understood). */
  warnings: string[];
  /** Bytes of the YAML output (UTF-8). */
  outputBytes: number;
}

/* -------------------------------------------------------------------------- */
/* Tokenizer - shell-like, no external deps                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tokenise a shell command string into an array of tokens.
 *
 * Handles:
 *   - Single-quoted strings (literal, no escaping inside).
 *   - Double-quoted strings (`\"` → `"`, `\\` → `\`, other backslashes
 *     preserved literally).
 *   - Backslash escapes outside quotes (`\x` → `x`, including `\ ` → space).
 *   - Line continuations: `\` immediately followed by `\n` joins lines.
 *   - Full-line comments: a line whose first non-whitespace char is `#` is
 *     skipped entirely (only outside quotes).
 *   - Shell separators `;`, `&`, `|` outside quotes are emitted as their
 *     own single-char tokens so callers can split a multi-command pipeline
 *     or `&&`/`;`-joined script into segments.
 *
 * The tokenizer never throws - malformed quoting simply terminates the
 * current token gracefully (the parser surfaces a clear error).
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let buf = '';
  let hasBuf = false;
  let i = 0;
  const s = input;
  const n = s.length;

  // Line-comment handling: track whether we are at the start of a line (only
  // meaningful outside quotes). A `#` at the start of a line (after optional
  // whitespace) begins a comment that runs to end of line.
  let atLineStart = true;

  function push(): void {
    if (hasBuf) {
      tokens.push(buf);
      buf = '';
      hasBuf = false;
    }
  }

  while (i < n) {
    const ch = s[i]!;

    // Line continuation: backslash + newline → join (skip both).
    if (ch === '\\' && s[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (ch === '\\' && s[i + 1] === '\r' && s[i + 2] === '\n') {
      i += 3;
      continue;
    }

    // Newline / carriage return: token boundary + return to line start.
    if (ch === '\n' || ch === '\r') {
      push();
      atLineStart = true;
      i += 1;
      continue;
    }

    // Line-start comment: skip to end of line.
    if (atLineStart) {
      // Skip leading whitespace on a fresh line without emitting tokens.
      if (ch === ' ' || ch === '\t') {
        i += 1;
        continue;
      }
      if (ch === '#') {
        // Consume until newline.
        while (i < n && s[i] !== '\n') i += 1;
        continue;
      }
      atLineStart = false;
      // Fall through to normal char handling.
    }

    // Whitespace: token boundary.
    if (ch === ' ' || ch === '\t') {
      push();
      i += 1;
      continue;
    }

    // Shell separators (outside quotes): own token.
    if (ch === ';' || ch === '&' || ch === '|') {
      push();
      tokens.push(ch);
      i += 1;
      continue;
    }

    // Single-quoted string.
    if (ch === "'") {
      hasBuf = true;
      i += 1;
      while (i < n && s[i] !== "'") {
        buf += s[i];
        i += 1;
      }
      // Skip closing quote (if any).
      if (i < n) i += 1;
      continue;
    }

    // Double-quoted string.
    if (ch === '"') {
      hasBuf = true;
      i += 1;
      while (i < n && s[i] !== '"') {
        const c = s[i]!;
        if (c === '\\' && i + 1 < n) {
          const nxt = s[i + 1]!;
          if (nxt === '"' || nxt === '\\') {
            buf += nxt;
            i += 2;
            continue;
          }
          // Other backslash sequences preserved literally inside double
          // quotes (matches POSIX shell behaviour).
          buf += '\\';
          buf += nxt;
          i += 2;
          continue;
        }
        buf += c;
        i += 1;
      }
      if (i < n) i += 1;
      continue;
    }

    // Backslash escape outside quotes.
    if (ch === '\\' && i + 1 < n) {
      hasBuf = true;
      buf += s[i + 1];
      i += 2;
      continue;
    }

    // Plain character.
    hasBuf = true;
    buf += ch;
    i += 1;
  }
  push();
  return tokens;
}

/* -------------------------------------------------------------------------- */
/* Segment splitting                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Split a token stream into segments on shell separators (`;`, `&`, `|`).
 * Consecutive separators produce empty segments which the caller drops.
 * Each segment is the token list of one (potential) command.
 */
export function splitSegments(tokens: string[]): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];
  for (const tok of tokens) {
    if (tok === ';' || tok === '&' || tok === '|') {
      segments.push(current);
      current = [];
      continue;
    }
    current.push(tok);
  }
  segments.push(current);
  return segments.filter((seg) => seg.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Flag tables                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Short flags that consume a value as the next token (or as the remainder of
 * the same token, e.g. `-p80:80`).
 */
const SHORT_VALUE_FLAGS = new Set(['p', 'v', 'e', 'h', 'u', 'w', 'l']);

/**
 * Long flags that consume a value. Mapped to the compose key they populate
 * (`null` means "recognised but not emitted by this tool" - consumed and
 * warned).
 */
const LONG_VALUE_FLAGS: Record<string, string | null> = {
  '--name': 'container_name',
  '--hostname': 'hostname',
  '--publish': 'ports',
  '--volume': 'volumes',
  '--env': 'environment',
  '--env-file': 'env_file',
  '--network': 'networks',
  '--restart': 'restart',
  '--label': 'labels',
  '--user': 'user',
  '--workdir': 'working_dir',
  '--entrypoint': 'entrypoint',
  // Common docker run value flags that compose models differently - we
  // consume their value and emit a warning rather than silently dropping it
  // (which would risk eating the image as the value).
  '--memory': null,
  '--memory-swap': null,
  '--memory-reservation': null,
  '--memory-swappiness': null,
  '--kernel-memory': null,
  '--cpus': null,
  '--cpu-shares': null,
  '--cpu-period': null,
  '--cpu-quota': null,
  '--cpuset-cpus': null,
  '--cpuset-mems': null,
  '--blkio-weight': null,
  '--blkio-weight-device': null,
  '--cap-add': null,
  '--cap-drop': null,
  '--device': null,
  '--device-cgroup-rule': null,
  '--device-read-bps': null,
  '--device-write-bps': null,
  '--device-read-iops': null,
  '--device-write-iops': null,
  '--dns': null,
  '--dns-option': null,
  '--dns-search': null,
  '--add-host': null,
  '--expose': null,
  '--link': null,
  '--log-driver': null,
  '--log-opt': null,
  '--health-cmd': null,
  '--health-interval': null,
  '--health-retries': null,
  '--health-start-period': null,
  '--health-timeout': null,
  '--stop-signal': null,
  '--stop-timeout': null,
  '--pull': null,
  '--platform': null,
  '--runtime': null,
  '--security-opt': null,
  '--storage-opt': null,
  '--tmpfs': null,
  '--volume-driver': null,
  '--volumes-from': null,
  '--cgroup-parent': null,
  '--cidfile': null,
  '--detach-keys': null,
  '--ip': null,
  '--ip6': null,
  '--mac-address': null,
  '--mount': null,
  '--isolation': null,
  '--gpus': null,
  '--pid': null,
  '--pids-limit': null,
  '--shm-size': null,
  '--ulimit': null,
  '--oom-score-adj': null,
  '--io-maxbandwidth': null,
  '--io-maxiops': null,
};

/**
 * Long flags that are boolean (no value). Common docker run booleans that
 * compose either manages itself (detach/rm) or models differently. We
 * silently ignore the ones compose manages, and warn for the rest.
 */
const LONG_SILENT_BOOLEAN_FLAGS = new Set([
  '--detach',
  '--rm',
  '--tty',
  '--interactive',
  '--init',
  '--privileged',
  '--read-only',
  '--no-healthcheck',
  '--sig-proxy',
]);

/** Short boolean flags that we silently ignore (compose-managed). */
const SHORT_SILENT_BOOLEAN_FLAGS = new Set([
  'd',
  't',
  'i',
  'P',
  'a',
  'r',
]);

/* -------------------------------------------------------------------------- */
/* Parser                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Parse a single token segment (the tokens of one command) as a
 * `docker run` invocation.
 *
 * The segment must begin with optional `sudo` prefixes, then `docker`
 * (optionally followed by `container`), then `run`. Anything after `run`
 * is the docker-run argument list. Returns `null` if the segment is not a
 * `docker run` command (so callers can skip non-docker commands in a
 * script).
 */
export function parseDockerRun(segment: string[]): ParsedService | null {
  // Find the `run` keyword. It must come after `docker` (or `sudo docker`),
  // optionally with `container` in between.
  let idx = 0;
  // Skip leading `sudo`.
  while (idx < segment.length && segment[idx] === 'sudo') idx += 1;
  if (idx >= segment.length) return null;
  if (segment[idx] !== 'docker') return null;
  idx += 1;
  // Optional `container`.
  if (idx < segment.length && segment[idx] === 'container') idx += 1;
  if (idx >= segment.length || segment[idx] !== 'run') return null;
  idx += 1;

  const args = segment.slice(idx);
  const service: ComposeService = {};
  const warnings: string[] = [];
  const entrypointParts: string[] = [];
  let image: string | null = null;
  const commandParts: string[] = [];

  let i = 0;
  while (i < args.length) {
    const tok = args[i]!;

    // Once the image has been seen, every remaining token is part of the
    // container command - docker passes them through verbatim, so we must
    // NOT interpret them as flags (e.g. `nginx -g "daemon off;"`).
    if (image !== null) {
      commandParts.push(tok);
      i += 1;
      continue;
    }

    // Long flag: --name, --name=value, --publish, ...
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const flagName = eq === -1 ? tok : tok.slice(0, eq);
      const inlineValue = eq === -1 ? null : tok.slice(eq + 1);

      // Boolean (no value) long flags.
      if (LONG_SILENT_BOOLEAN_FLAGS.has(flagName)) {
        i += 1;
        continue;
      }

      if (flagName in LONG_VALUE_FLAGS) {
        const composeKey = LONG_VALUE_FLAGS[flagName]!;
        let value: string;
        if (inlineValue !== null) {
          value = inlineValue;
        } else if (i + 1 < args.length) {
          // Docker consumes the next token as the value unconditionally -
          // the value may itself start with `-` (e.g. `--entrypoint -c`).
          value = args[i + 1]!;
          i += 1; // advance onto the value token; the trailing `i += 1`
          // below then moves past it.
        } else {
          warnings.push(`flag ${flagName} expects a value but none was given - ignored.`);
          i += 1;
          continue;
        }
        applyValueFlag(service, composeKey, value, entrypointParts, warnings, flagName);
        i += 1;
        continue;
      }

      // Unknown long flag. Best-effort: consume a value if one is inline or
      // the next token does not look like a flag (conservative - we don't
      // want to eat the image as a value for an unknown flag).
      if (inlineValue !== null) {
        warnings.push(`unsupported flag ${flagName}=${inlineValue} - ignored.`);
        i += 1;
        continue;
      }
      if (i + 1 < args.length && !args[i + 1]!.startsWith('-')) {
        warnings.push(`unsupported flag ${flagName} ${args[i + 1]} - ignored.`);
        i += 2;
        continue;
      }
      warnings.push(`unsupported flag ${flagName} - ignored.`);
      i += 1;
      continue;
    }

    // Short flag bundle: -p, -itd, -vpath, ...
    if (tok.startsWith('-') && tok.length > 1 && tok !== '--') {
      let j = 1;
      while (j < tok.length) {
        const c = tok[j]!;
        if (SHORT_SILENT_BOOLEAN_FLAGS.has(c)) {
          j += 1;
          continue;
        }
        if (SHORT_VALUE_FLAGS.has(c)) {
          const composeKey = shortFlagComposeKey(c);
          // Remainder of the token is the value, else next token.
          let rest = tok.slice(j + 1);
          // Tolerate the `-p=22:22` form by stripping a single leading `=`
          // separator (docker's short flags don't officially use `=`, but
          // users sometimes type it).
          if (rest.startsWith('=')) rest = rest.slice(1);
          let value: string;
          if (rest.length > 0) {
            value = rest;
            j = tok.length;
          } else if (i + 1 < args.length) {
            // Consume the next token unconditionally (docker semantics).
            value = args[i + 1]!;
            i += 1;
            j = tok.length;
          } else {
            warnings.push(`flag -${c} expects a value but none was given - ignored.`);
            j += 1;
            continue;
          }
          applyValueFlag(service, composeKey, value, entrypointParts, warnings, `-${c}`);
          break;
        }
        // Unknown short flag - treat as boolean and warn.
        warnings.push(`unsupported flag -${c} - ignored.`);
        j += 1;
      }
      i += 1;
      continue;
    }

    // Bare `-` (stdin) - ignore.
    if (tok === '-') {
      i += 1;
      continue;
    }

    // First positional argument is the image (image is still null here -
    // once it is set, the top-of-loop guard pushes the rest to command).
    image = tok;
    i += 1;
  }

  if (image === null) {
    warnings.push('no image specified.');
  } else {
    service.image = image;
  }

  if (entrypointParts.length === 1) {
    service.entrypoint = entrypointParts[0]!;
  } else if (entrypointParts.length > 1) {
    service.entrypoint = entrypointParts.slice();
  }

  if (commandParts.length > 0) {
    service.command = commandParts;
  }

  const name = deriveServiceName(service.container_name, service.image);

  return { name, service, warnings };
}

/** Map a short value-flag character to its compose key. */
function shortFlagComposeKey(c: string): string {
  switch (c) {
    case 'p':
      return 'ports';
    case 'v':
      return 'volumes';
    case 'e':
      return 'environment';
    case 'h':
      return 'hostname';
    case 'u':
      return 'user';
    case 'w':
      return 'working_dir';
    case 'l':
      return 'labels';
    default:
      return '';
  }
}

/**
 * Apply a value-bearing flag to the service object.
 *
 * `entrypointParts` is collected separately because `--entrypoint` may be
 * repeated to build a list; we resolve it to a string-or-list in
 * `parseDockerRun` after the loop.
 */
function applyValueFlag(
  service: ComposeService,
  composeKey: string,
  value: string,
  entrypointParts: string[],
  warnings: string[],
  flagLabel: string,
): void {
  switch (composeKey) {
    case 'container_name':
      service.container_name = value;
      break;
    case 'hostname':
      service.hostname = value;
      break;
    case 'ports':
      (service.ports ??= []).push(value);
      break;
    case 'volumes':
      (service.volumes ??= []).push(value);
      break;
    case 'env_file':
      (service.env_file ??= []).push(value);
      break;
    case 'networks':
      (service.networks ??= []).push(value);
      break;
    case 'restart':
      service.restart = value;
      break;
    case 'user':
      service.user = value;
      break;
    case 'working_dir':
      service.working_dir = value;
      break;
    case 'environment': {
      const eqIdx = value.indexOf('=');
      if (eqIdx === -1) {
        // `-e FOO` → inherit from host (null value).
        (service.environment ??= {})[value] = null;
      } else {
        const k = value.slice(0, eqIdx);
        const v = value.slice(eqIdx + 1);
        if (k.length === 0) {
          warnings.push(`flag ${flagLabel} has an empty env name "${value}" - ignored.`);
          break;
        }
        (service.environment ??= {})[k] = v;
      }
      break;
    }
    case 'labels': {
      const eqIdx = value.indexOf('=');
      if (eqIdx === -1) {
        (service.labels ??= {})[value] = '';
      } else {
        const k = value.slice(0, eqIdx);
        const v = value.slice(eqIdx + 1);
        if (k.length === 0) {
          warnings.push(`flag ${flagLabel} has an empty label name "${value}" - ignored.`);
          break;
        }
        (service.labels ??= {})[k] = v;
      }
      break;
    }
    case 'entrypoint':
      entrypointParts.push(value);
      break;
    default:
      // Recognised-but-not-emitted flag (e.g. --memory, --cpus). The value
      // was consumed by the caller so it doesn't get mistaken for the image
      // or command; warn so the user knows it was dropped from the output.
      warnings.push(
        `flag ${flagLabel} is recognised by docker but not emitted in the compose output - ignored.`,
      );
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Service-name derivation + de-duplication                                    */
/* -------------------------------------------------------------------------- */

/**
 * Derive a compose service name from `--name` (preferred) or the image.
 *
 * Compose service names must match `^[a-zA-Z0-9._-]+$`. We sanitise by
 * lowercasing and replacing every disallowed character with `-`. If the
 * result is empty, `service` is used as a fallback.
 */
export function deriveServiceName(containerName: string | undefined, image: string | undefined): string {
  let raw = containerName ?? '';
  if (!raw && image) {
    // Take the last path segment of the image, then strip the tag.
    const noTag = image.split('/').pop() ?? image;
    raw = noTag.split(':')[0] ?? noTag;
  }
  const sanitised = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitised || 'service';
}

/**
 * Ensure a service name is unique within the file. If `base` already exists,
 * append `-2`, `-3`, … until a free key is found.
 */
function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  const name = `${base}-${n}`;
  taken.add(name);
  return name;
}

/* -------------------------------------------------------------------------- */
/* Top-level parse + serialise                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Parse the full input string into a list of `ParsedService` entries.
 *
 * The input may contain one or more `docker run` commands joined by `&&`,
 * `||`, `;`, `|`, or newlines. Non-docker commands in the same script
 * (e.g. `cd app`) are silently skipped.
 */
export function parseInput(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Paste a `docker run` command above.', services: [], warnings: [] };
  }
  const tokens = tokenize(input);
  const segments = splitSegments(tokens);

  const services: ParsedService[] = [];
  const warnings: string[] = [];
  const taken = new Set<string>();

  for (const seg of segments) {
    const parsed = parseDockerRun(seg);
    if (!parsed) continue; // not a docker run - skip silently
    const name = uniqueName(parsed.name, taken);
    services.push({ ...parsed, name });
    if (parsed.warnings.length > 0) {
      warnings.push(...parsed.warnings.map((w) => `[${name}] ${w}`));
    }
  }

  if (services.length === 0) {
    return {
      ok: false,
      error: 'No `docker run` command found. Expected input starting with `docker run`.',
      services: [],
      warnings,
    };
  }
  return { ok: true, error: '', services, warnings };
}

/** Build a `ComposeFile` object from parsed services. */
export function buildComposeFile(services: ParsedService[]): ComposeFile {
  const file: ComposeFile = { services: {} };
  for (const s of services) {
    file.services[s.name] = s.service;
  }
  return file;
}

/**
 * Serialise a `ComposeFile` to a YAML string.
 *
 * Uses the `yaml` package (initial bundle) with 2-space indentation and
 * block-style collections so the output reads like a hand-written
 * `docker-compose.yml`. Empty service objects are still emitted (the user
 * will see `name: {}`).
 */
export function composeFileToYaml(file: ComposeFile): string {
  return yamlStringify(file, {
    indent: 2,
    lineWidth: 0, // don't wrap long port/volume strings
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
}

/**
 * Convert a `docker run` command string to a `docker-compose.yml`.
 *
 * This is the main entry point used by the composable. Returns a
 * `ConvertResult` with the YAML text and any warnings. On a hard error
 * (empty input, no docker run found) it throws an `Error` whose `message`
 * is safe to surface to the user.
 */
export function convertDockerRun(input: string): ConvertResult {
  const parsed = parseInput(input);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const file = buildComposeFile(parsed.services);
  const yaml = composeFileToYaml(file);
  return {
    yaml,
    serviceCount: parsed.services.length,
    warnings: parsed.warnings,
    outputBytes: new TextEncoder().encode(yaml).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseDockerRunToComposeReturn {
  input: Ref<string>;
  outputs: Ref<ConvertResult | null>;
  error: Ref<string>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  recompute: () => void;
}

/** Debounce window (ms) for recomputing on input changes. */
const DEBOUNCE_MS = 150;

export function useDockerRunToCompose(): UseDockerRunToComposeReturn {
  const input = ref<string>('');
  const outputs = ref<ConvertResult | null>(null);
  const error = ref<string>('');

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function run(): void {
    const text = input.value;
    if (text.trim().length === 0) {
      outputs.value = null;
      error.value = '';
      return;
    }
    try {
      outputs.value = convertDockerRun(text);
      error.value = '';
    } catch (e) {
      outputs.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    }
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

  watch(input, scheduleRun);

  const { isEmbed, input: embedInput, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      } else if (typeof p.command === 'string') {
        input.value = p.command;
      } else if (typeof p.docker === 'string') {
        input.value = p.docker;
      } else if (typeof p.dockerRun === 'string') {
        input.value = p.dockerRun;
      } else if (typeof p.value === 'string') {
        input.value = p.value;
      } else if (typeof p.content === 'string') {
        input.value = p.content;
      }
    },
  });

  watch(outputs, (o) => {
    if (isEmbed.value) {
      sendOutput(o ?? {});
    }
  });

  return {
    input,
    outputs,
    error,
    isEmbed,
    embedInput,
    recompute,
  };
}
