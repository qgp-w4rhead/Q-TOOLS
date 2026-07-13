/**
 * useChmodCalculator — composable + pure logic for the Chmod calculator tool.
 *
 * Interactive Unix file permission calculator covering the three permission
 * scopes (owner / group / other) × three permission bits (read / write /
 * execute), plus the three special bits (setuid / setgid / sticky).
 *
 * The pure helpers (`permissionsToOctal`, `permissionsToSymbolic`,
 * `octalToPermissions`, `symbolicToPermissions`, `describePermissions`,
 * `validateOctal`, `validateSymbolic`) have no Vue dependency and can be
 * imported standalone for unit testing or reuse. The `useChmodCalculator()`
 * composable wraps them in reactive state and wires up the embed PostMessage
 * protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic — no Vue dependency below this point                            */
/* -------------------------------------------------------------------------- */

/** The three permission scopes, in canonical octal order. */
export type PermissionScope = 'owner' | 'group' | 'other';

/** The three permission bits within a scope. */
export type PermissionBit = 'read' | 'write' | 'execute';

/** The three special bits (setuid / setgid / sticky). */
export type SpecialBit = 'setuid' | 'setgid' | 'sticky';

/** Per-scope permission flags. */
export interface ScopePermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
}

/** Full permission set: three scopes + three special bits. */
export interface ChmodPermissions {
  owner: ScopePermissions;
  group: ScopePermissions;
  other: ScopePermissions;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

/** Canonical scope order (owner, group, other). */
export const SCOPE_ORDER: PermissionScope[] = ['owner', 'group', 'other'];

/** Canonical bit order within a scope (read, write, execute). */
export const BIT_ORDER: PermissionBit[] = ['read', 'write', 'execute'];

/** Numeric weight of each bit within a scope (r=4, w=2, x=1). */
export const BIT_WEIGHT: Record<PermissionBit, number> = {
  read: 4,
  write: 2,
  execute: 1,
};

/** Numeric weight of each special bit (setuid=4, setgid=2, sticky=1). */
export const SPECIAL_WEIGHT: Record<SpecialBit, number> = {
  setuid: 4,
  setgid: 2,
  sticky: 1,
};

/** Human labels for each scope. */
export const SCOPE_LABEL: Record<PermissionScope, string> = {
  owner: 'Owner',
  group: 'Group',
  other: 'Other',
};

/** Human labels for each bit. */
export const BIT_LABEL: Record<PermissionBit, string> = {
  read: 'Read',
  write: 'Write',
  execute: 'Execute',
};

/** Default permissions: 755 (owner rwx, group r-x, other r-x), no special bits. */
export function defaultPermissions(): ChmodPermissions {
  return {
    owner: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    other: { read: true, write: false, execute: true },
    setuid: false,
    setgid: false,
    sticky: false,
  };
}

/** Compute the octal digit (0-7) for a single scope. */
export function scopeDigit(scope: ScopePermissions): number {
  let d = 0;
  if (scope.read) d += BIT_WEIGHT.read;
  if (scope.write) d += BIT_WEIGHT.write;
  if (scope.execute) d += BIT_WEIGHT.execute;
  return d;
}

/** Compute the special-bits octal digit (0-7). */
export function specialDigit(perm: ChmodPermissions): number {
  let d = 0;
  if (perm.setuid) d += SPECIAL_WEIGHT.setuid;
  if (perm.setgid) d += SPECIAL_WEIGHT.setgid;
  if (perm.sticky) d += SPECIAL_WEIGHT.sticky;
  return d;
}

/**
 * Render the permissions as a numeric (octal) string.
 *
 * - Without special bits: 3 digits, e.g. `755`.
 * - With special bits: 4 digits, e.g. `4755`.
 */
export function permissionsToOctal(perm: ChmodPermissions): string {
  const digits = SCOPE_ORDER.map((s) => scopeDigit(perm[s]));
  const special = specialDigit(perm);
  if (special > 0) {
    return `${special}${digits.join('')}`;
  }
  return digits.join('');
}

/**
 * Render a single scope's permissions as a 3-char symbolic string (`rwx`).
 * Honours special bits in the execute position:
 *   - setuid on owner: `s` if execute, `S` if not.
 *   - setgid on group: `s` if execute, `S` if not.
 *   - sticky on other: `t` if execute, `T` if not.
 */
export function scopeSymbolic(
  scope: PermissionScope,
  s: ScopePermissions,
  perm: ChmodPermissions,
): string {
  const r = s.read ? 'r' : '-';
  const w = s.write ? 'w' : '-';
  let x = s.execute ? 'x' : '-';
  if (scope === 'owner' && perm.setuid) {
    x = s.execute ? 's' : 'S';
  } else if (scope === 'group' && perm.setgid) {
    x = s.execute ? 's' : 'S';
  } else if (scope === 'other' && perm.sticky) {
    x = s.execute ? 't' : 'T';
  }
  return `${r}${w}${x}`;
}

/**
 * Render the full 9-char symbolic string (e.g. `rwxr-xr-x`), with special-bit
 * markers in the execute positions.
 */
export function permissionsToSymbolic(perm: ChmodPermissions): string {
  return SCOPE_ORDER.map((s) => scopeSymbolic(s, perm[s], perm)).join('');
}

/** Build a `ScopePermissions` from an octal digit (0-7). */
export function digitToScope(d: number): ScopePermissions {
  return {
    read: (d & BIT_WEIGHT.read) !== 0,
    write: (d & BIT_WEIGHT.write) !== 0,
    execute: (d & BIT_WEIGHT.execute) !== 0,
  };
}

/**
 * Parse a numeric (octal) string into permissions.
 *
 * Accepts 3 digits (`755`) or 4 digits (`4755`, `0755`). Extra leading zeros
 * are tolerated. Returns `null` if the string is not a valid octal permission.
 */
export function octalToPermissions(raw: string): ChmodPermissions | null {
  const trimmed = raw.trim();
  if (!/^[0-7]{3,4}$/.test(trimmed)) return null;
  const perm = defaultPermissions();
  // Zero out defaults so we don't inherit 755.
  perm.owner = { read: false, write: false, execute: false };
  perm.group = { read: false, write: false, execute: false };
  perm.other = { read: false, write: false, execute: false };
  perm.setuid = false;
  perm.setgid = false;
  perm.sticky = false;

  let digits = trimmed;
  if (digits.length === 4) {
    const special = Number(digits[0]);
    perm.setuid = (special & SPECIAL_WEIGHT.setuid) !== 0;
    perm.setgid = (special & SPECIAL_WEIGHT.setgid) !== 0;
    perm.sticky = (special & SPECIAL_WEIGHT.sticky) !== 0;
    digits = digits.slice(1);
  }
  perm.owner = digitToScope(Number(digits[0]));
  perm.group = digitToScope(Number(digits[1]));
  perm.other = digitToScope(Number(digits[2]));
  return perm;
}

/**
 * Parse a 9-char symbolic string (e.g. `rwxr-xr-x`) into permissions.
 *
 * Honours the special-bit markers in the execute positions:
 *   - `s` (lowercase) → setuid/setgid set AND execute set.
 *   - `S` (uppercase) → setuid/setgid set BUT execute NOT set.
 *   - `t` (lowercase) → sticky set AND execute set.
 *   - `T` (uppercase) → sticky set BUT execute NOT set.
 *
 * The read/write positions (`r`/`w`/`-`) are case-insensitive; the execute
 * position markers are case-sensitive (case carries the execute flag).
 * Returns `null` if the string is not a valid 9-char symbolic permission.
 */
export function symbolicToPermissions(raw: string): ChmodPermissions | null {
  const s = raw.trim();
  if (s.length !== 9) return null;
  // Allowed characters per position.
  // Positions 0,3,6 → r|R|-
  // Positions 1,4,7 → w|W|-
  // Position 2 (owner exec) → x|X|s|S|-
  // Position 5 (group exec) → x|X|s|S|-
  // Position 8 (other exec) → x|X|t|T|-
  const allowed: Record<number, string[]> = {
    0: ['r', 'R', '-'],
    1: ['w', 'W', '-'],
    2: ['x', 'X', 's', 'S', '-'],
    3: ['r', 'R', '-'],
    4: ['w', 'W', '-'],
    5: ['x', 'X', 's', 'S', '-'],
    6: ['r', 'R', '-'],
    7: ['w', 'W', '-'],
    8: ['x', 'X', 't', 'T', '-'],
  };
  for (let i = 0; i < 9; i++) {
    const ch = s[i]!;
    if (!allowed[i]!.includes(ch)) return null;
  }
  const ownerExec = s[2] === 'x' || s[2] === 'X' || s[2] === 's';
  const groupExec = s[5] === 'x' || s[5] === 'X' || s[5] === 's';
  const otherExec = s[8] === 'x' || s[8] === 'X' || s[8] === 't';
  const perm = defaultPermissions();
  perm.owner = {
    read: s[0] === 'r' || s[0] === 'R',
    write: s[1] === 'w' || s[1] === 'W',
    execute: ownerExec,
  };
  perm.group = {
    read: s[3] === 'r' || s[3] === 'R',
    write: s[4] === 'w' || s[4] === 'W',
    execute: groupExec,
  };
  perm.other = {
    read: s[6] === 'r' || s[6] === 'R',
    write: s[7] === 'w' || s[7] === 'W',
    execute: otherExec,
  };
  // setuid/setgid: s (lowercase) = with execute, S (uppercase) = without.
  perm.setuid = s[2] === 's' || s[2] === 'S';
  perm.setgid = s[5] === 's' || s[5] === 'S';
  // sticky: t (lowercase) = with execute, T (uppercase) = without.
  perm.sticky = s[8] === 't' || s[8] === 'T';
  return perm;
}

/** Validation result for an octal string. */
export interface PermissionValidation {
  ok: boolean;
  message: string;
}

/** Validate an octal permission string (3 or 4 digits, 0-7). */
export function validateOctal(raw: string): PermissionValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: 'Enter an octal value (e.g. 755).' };
  if (!/^[0-7]+$/.test(trimmed)) {
    return { ok: false, message: 'Only digits 0-7 are allowed in octal mode.' };
  }
  if (trimmed.length < 3 || trimmed.length > 4) {
    return { ok: false, message: 'Expected 3 or 4 octal digits (e.g. 755 or 4755).' };
  }
  return { ok: true, message: '' };
}

/** Validate a 9-char symbolic permission string. */
export function validateSymbolic(raw: string): PermissionValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: 'Enter a symbolic mode (e.g. rwxr-xr-x).' };
  const parsed = symbolicToPermissions(trimmed);
  if (!parsed) {
    return {
      ok: false,
      message:
        'Symbolic mode must be 9 chars: r/w/x/- (and s/S/t/T in execute positions).',
    };
  }
  return { ok: true, message: '' };
}

/** Describe a single scope in plain English. */
function describeScope(scope: PermissionScope, s: ScopePermissions): string {
  const bits: string[] = [];
  if (s.read) bits.push('read');
  if (s.write) bits.push('write');
  if (s.execute) bits.push('execute');
  const label = SCOPE_LABEL[scope].toLowerCase();
  if (bits.length === 0) return `${label}: no permissions`;
  if (bits.length === 3) return `${label}: full (read, write, execute)`;
  return `${label}: ${bits.join(', ')}`;
}

/** Describe the special bits in plain English. */
function describeSpecial(perm: ChmodPermissions): string[] {
  const out: string[] = [];
  if (perm.setuid) out.push('setuid (run as owner)');
  if (perm.setgid) out.push('setgid (run as group)');
  if (perm.sticky) out.push('sticky (only owner can delete files in this directory)');
  return out;
}

/** Compose a full human-readable description of the permissions. */
export function describePermissions(perm: ChmodPermissions): string {
  const scopes = SCOPE_ORDER.map((s) => describeScope(s, perm[s]));
  const special = describeSpecial(perm);
  const parts = [...scopes, ...special];
  return parts.join('; ') + '.';
}

/* -------------------------------------------------------------------------- */
/* Composable — reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseChmodCalculatorReturn {
  permissions: Ref<ChmodPermissions>;
  octal: ComputedRef<string>;
  symbolic: ComputedRef<string>;
  description: ComputedRef<string>;
  isEmbed: Ref<boolean>;
  input: Ref<EmbedInputPayload | null>;
  toggleBit: (scope: PermissionScope, bit: PermissionBit) => void;
  toggleSpecial: (bit: SpecialBit) => void;
  setBit: (scope: PermissionScope, bit: PermissionBit, value: boolean) => void;
  setSpecial: (bit: SpecialBit, value: boolean) => void;
  loadOctal: (raw: string) => boolean;
  loadSymbolic: (raw: string) => boolean;
  reset: () => void;
}

export function useChmodCalculator(): UseChmodCalculatorReturn {
  const permissions = ref<ChmodPermissions>(defaultPermissions());

  const octal = computed(() => permissionsToOctal(permissions.value));
  const symbolic = computed(() => permissionsToSymbolic(permissions.value));
  const description = computed(() => describePermissions(permissions.value));

  function setBit(
    scope: PermissionScope,
    bit: PermissionBit,
    value: boolean,
  ): void {
    permissions.value = {
      ...permissions.value,
      [scope]: { ...permissions.value[scope], [bit]: value },
    };
  }

  function toggleBit(scope: PermissionScope, bit: PermissionBit): void {
    setBit(scope, bit, !permissions.value[scope][bit]);
  }

  function setSpecial(bit: SpecialBit, value: boolean): void {
    permissions.value = { ...permissions.value, [bit]: value };
  }

  function toggleSpecial(bit: SpecialBit): void {
    setSpecial(bit, !permissions.value[bit]);
  }

  function loadOctal(raw: string): boolean {
    const parsed = octalToPermissions(raw);
    if (!parsed) return false;
    permissions.value = parsed;
    return true;
  }

  function loadSymbolic(raw: string): boolean {
    const parsed = symbolicToPermissions(raw);
    if (!parsed) return false;
    permissions.value = parsed;
    return true;
  }

  function reset(): void {
    permissions.value = defaultPermissions();
  }

  const { isEmbed, input, sendOutput } = useEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.octal === 'string') {
        loadOctal(p.octal);
        return;
      }
      if (typeof p.numeric === 'string') {
        loadOctal(p.numeric);
        return;
      }
      if (typeof p.symbolic === 'string') {
        loadSymbolic(p.symbolic);
        return;
      }
      if (p.permissions && typeof p.permissions === 'object') {
        const incoming = p.permissions as Partial<ChmodPermissions>;
        const next = { ...permissions.value };
        for (const scope of SCOPE_ORDER) {
          const s = incoming[scope];
          if (s && typeof s === 'object') {
            next[scope] = { ...next[scope], ...(s as Partial<ScopePermissions>) };
          }
        }
        if (typeof incoming.setuid === 'boolean') next.setuid = incoming.setuid;
        if (typeof incoming.setgid === 'boolean') next.setgid = incoming.setgid;
        if (typeof incoming.sticky === 'boolean') next.sticky = incoming.sticky;
        permissions.value = next;
      }
    },
  });

  watch(
    octal,
    () => {
      if (isEmbed.value) {
        sendOutput({
          octal: octal.value,
          numeric: octal.value,
          symbolic: symbolic.value,
          description: description.value,
          permissions: permissions.value,
        });
      }
    },
    { immediate: true },
  );

  return {
    permissions,
    octal,
    symbolic,
    description,
    isEmbed,
    input,
    toggleBit,
    toggleSpecial,
    setBit,
    setSpecial,
    loadOctal,
    loadSymbolic,
    reset,
  };
}
