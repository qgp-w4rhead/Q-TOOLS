/**
 * useMailAuthRecordBuilder - composable + pure logic for the SPF / DKIM /
 * DMARC record builder tool.
 *
 * Builds DNS TXT records for the three email-authentication standards from a
 * form, and validates pasted records:
 *  - SPF:    `v=spf1 <mechanisms> ~all`   (RFC 7208)
 *  - DKIM:   `v=DKIM1; k=rsa; p=<key>`    (RFC 6376 + RFC 8301)
 *  - DMARC:  `v=DMARC1; p=<policy>; rua=…` (RFC 7489)
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useMailAuthRecordBuilder()` composable wraps
 * them in reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies.
 */
import { computed, ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* SPF                                                                         */
/* -------------------------------------------------------------------------- */

/** SPF `all` qualifier. */
export type SpfQualifier = '-' | '~' | '?' | '+';

export interface SpfConfig {
  /** Include the domain's A/AAAA records (`a`). */
  useA: boolean;
  /** Include the domain's MX hosts (`mx`). */
  useMx: boolean;
  /** Extra ip4: addresses/CIDRs, space-separated. */
  ip4: string;
  /** Extra ip6: addresses/CIDRs, space-separated. */
  ip6: string;
  /** include: domains, space-separated. */
  include: string;
  /** exists: domain (rarely used). */
  exists: string;
  /** redirect= domain (replaces `all` when set). */
  redirect: string;
  /** Qualifier for the trailing `all` mechanism. */
  allQualifier: SpfQualifier;
}

export const DEFAULT_SPF: SpfConfig = {
  useA: true,
  useMx: true,
  ip4: '',
  ip6: '',
  include: '',
  exists: '',
  redirect: '',
  allQualifier: '~',
};

/** Build an SPF record string from the config. */
export function buildSpf(c: SpfConfig): string {
  const parts: string[] = ['v=spf1'];
  if (c.useA) parts.push('a');
  if (c.useMx) parts.push('mx');
  for (const ip of c.ip4.split(/\s+/).filter(Boolean)) parts.push(`ip4:${ip}`);
  for (const ip of c.ip6.split(/\s+/).filter(Boolean)) parts.push(`ip6:${ip}`);
  for (const d of c.include.split(/\s+/).filter(Boolean)) parts.push(`include:${d}`);
  if (c.exists.trim()) parts.push(`exists:${c.exists.trim()}`);
  if (c.redirect.trim()) parts.push(`redirect=${c.redirect.trim()}`);
  else parts.push(`${c.allQualifier}all`);
  return parts.join(' ');
}

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Validate a pasted SPF record. Returns a list of issues (empty = valid). */
export function validateSpf(record: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = record.trim();
  if (!r) return issues;
  if (!/^v=spf1\b/i.test(r)) {
    issues.push({ level: 'error', message: 'Record must start with "v=spf1".' });
    return issues;
  }
  const terms = r.split(/\s+/).slice(1);
  let allCount = 0;
  let redirect = '';
  const mechRe = /^([+\-~?]?)(a|mx|ptr|ip4|ip6|include|exists|all)(?::([^\s]+))?$/i;
  const modRe = /^(redirect|exp)=([^\s]+)$/i;
  for (const t of terms) {
    const mech = mechRe.exec(t);
    const mod = modRe.exec(t);
    if (mech) {
      const name = mech[2]!.toLowerCase();
      if (name === 'all') allCount++;
      if (name === 'ptr') {
        issues.push({ level: 'warning', message: 'ptr mechanism is deprecated (RFC 7208 §5.5).' });
      }
      if ((name === 'ip4' || name === 'ip6' || name === 'include' || name === 'exists') && !mech[3]) {
        issues.push({ level: 'error', message: `Mechanism "${name}" requires a value (${t}).` });
      }
    } else if (mod) {
      if (mod[1]!.toLowerCase() === 'redirect') redirect = mod[2]!;
    } else {
      issues.push({ level: 'error', message: `Unknown term "${t}".` });
    }
  }
  if (allCount === 0 && !redirect) {
    issues.push({ level: 'warning', message: 'No "all" mechanism or redirect - record may be incomplete.' });
  }
  if (allCount > 1) {
    issues.push({ level: 'error', message: 'Multiple "all" mechanisms found.' });
  }
  if (redirect && allCount > 0) {
    issues.push({ level: 'warning', message: 'redirect= ignores the "all" mechanism.' });
  }
  const lookups = terms.filter((t) =>
    /^[+\-~?]?(a|mx|ptr|include|exists|redirect=)/i.test(t),
  ).length;
  if (lookups > 10) {
    issues.push({ level: 'error', message: `SPF allows max 10 DNS lookups - found ${lookups}.` });
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* DKIM                                                                        */
/* -------------------------------------------------------------------------- */

export interface DkimConfig {
  /** Selector (the `s=` tag / DNS label prefix). */
  selector: string;
  /** Domain the record belongs to (for the FQDN hint). */
  domain: string;
  /** Key type: rsa or ed25519. */
  keyType: 'rsa' | 'ed25519';
  /** Base64 public key (the `p=` value). */
  publicKey: string;
  /** Flags (`t=`): e.g. `y` testing, `s` strict. */
  flags: string;
}

export const DEFAULT_DKIM: DkimConfig = {
  selector: 'default',
  domain: '',
  keyType: 'rsa',
  publicKey: '',
  flags: '',
};

/** Build a DKIM TXT record value from the config. */
export function buildDkim(c: DkimConfig): string {
  const parts: string[] = ['v=DKIM1'];
  parts.push(`k=${c.keyType}`);
  if (c.flags.trim()) parts.push(`t=${c.flags.trim()}`);
  parts.push(`p=${c.publicKey.trim()}`);
  return parts.join('; ') + ';';
}

/** The DNS name a DKIM record is published at. */
export function dkimRecordName(c: DkimConfig): string {
  const sel = c.selector.trim() || 'default';
  const dom = c.domain.trim();
  return dom ? `${sel}._domainkey.${dom}` : `${sel}._domainkey.example.com`;
}

/** Validate a pasted DKIM record. */
export function validateDkim(record: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = record.trim();
  if (!r) return issues;
  const tags = new Map<string, string>();
  for (const part of r.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) {
      if (part.trim()) issues.push({ level: 'error', message: `Malformed tag "${part.trim()}".` });
      continue;
    }
    tags.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  const v = tags.get('v');
  if (v && v !== 'DKIM1') {
    issues.push({ level: 'warning', message: `Unexpected version "${v}" (expected DKIM1).` });
  }
  const k = tags.get('k');
  if (k && k !== 'rsa' && k !== 'ed25519') {
    issues.push({ level: 'warning', message: `Unknown key type "${k}".` });
  }
  const p = tags.get('p');
  if (p === undefined) {
    issues.push({ level: 'error', message: 'Missing required p= (public key) tag.' });
  } else if (p === '') {
    issues.push({ level: 'info', message: 'Empty p= means the key is revoked.' });
  } else if (!/^[0-9a-zA-Z+/=\s]+$/.test(p)) {
    issues.push({ level: 'error', message: 'p= value is not valid base64.' });
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* DMARC                                                                       */
/* -------------------------------------------------------------------------- */

export type DmarcPolicy = 'none' | 'quarantine' | 'reject';

export interface DmarcConfig {
  policy: DmarcPolicy;
  /** Subdomain policy (defaults to `policy` when empty). */
  sp: '' | DmarcPolicy;
  /** Aggregate report URI(s), space-separated mailto:. */
  rua: string;
  /** Forensic report URI(s), space-separated mailto:. */
  ruf: string;
  /** Percentage of mail to apply the policy to (1-100). */
  pct: number;
  /** DKIM alignment: r (relaxed) or s (strict). */
  adkim: 'r' | 's';
  /** SPF alignment: r (relaxed) or s (strict). */
  aspf: 'r' | 's';
  /** Failure reporting options (fo=). */
  fo: string;
}

export const DEFAULT_DMARC: DmarcConfig = {
  policy: 'none',
  sp: '',
  rua: '',
  ruf: '',
  pct: 100,
  adkim: 'r',
  aspf: 'r',
  fo: '',
};

/** Build a DMARC TXT record value from the config. */
export function buildDmarc(c: DmarcConfig): string {
  const parts: string[] = ['v=DMARC1', `p=${c.policy}`];
  if (c.sp) parts.push(`sp=${c.sp}`);
  if (c.rua.trim()) {
    const uris = c.rua.split(/\s+/).filter(Boolean).join(',');
    parts.push(`rua=${uris}`);
  }
  if (c.ruf.trim()) {
    const uris = c.ruf.split(/\s+/).filter(Boolean).join(',');
    parts.push(`ruf=${uris}`);
  }
  if (c.pct !== 100) parts.push(`pct=${Math.max(1, Math.min(100, Math.floor(c.pct)))}`);
  if (c.adkim !== 'r') parts.push(`adkim=${c.adkim}`);
  if (c.aspf !== 'r') parts.push(`aspf=${c.aspf}`);
  if (c.fo.trim()) parts.push(`fo=${c.fo.trim()}`);
  return parts.join('; ') + ';';
}

/** The DNS name a DMARC record is published at. */
export function dmarcRecordName(domain: string): string {
  const d = domain.trim();
  return d ? `_dmarc.${d}` : '_dmarc.example.com';
}

/** Validate a pasted DMARC record. */
export function validateDmarc(record: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const r = record.trim();
  if (!r) return issues;
  const tags = new Map<string, string>();
  for (const part of r.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) {
      if (part.trim()) issues.push({ level: 'error', message: `Malformed tag "${part.trim()}".` });
      continue;
    }
    tags.set(part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim());
  }
  if (tags.get('v') !== 'DMARC1') {
    issues.push({ level: 'error', message: 'Record must contain v=DMARC1.' });
  }
  const p = tags.get('p');
  if (!p) {
    issues.push({ level: 'error', message: 'Missing required p= (policy) tag.' });
  } else if (!['none', 'quarantine', 'reject'].includes(p)) {
    issues.push({ level: 'error', message: `Invalid policy "${p}".` });
  }
  const sp = tags.get('sp');
  if (sp && !['none', 'quarantine', 'reject'].includes(sp)) {
    issues.push({ level: 'error', message: `Invalid subdomain policy "${sp}".` });
  }
  const pct = tags.get('pct');
  if (pct !== undefined) {
    const n = Number(pct);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      issues.push({ level: 'error', message: `pct must be an integer 1-100 (got "${pct}").` });
    }
  }
  for (const key of ['rua', 'ruf'] as const) {
    const val = tags.get(key);
    if (val) {
      for (const uri of val.split(',')) {
        if (!/^mailto:[^\s]+@[^\s]+$/.test(uri.trim())) {
          issues.push({ level: 'warning', message: `${key} URI "${uri.trim()}" is not a mailto: address.` });
        }
      }
    }
  }
  if (p === 'none') {
    issues.push({ level: 'info', message: 'p=none only monitors - move to quarantine/reject once confident.' });
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export type MailAuthTab = 'spf' | 'dkim' | 'dmarc';

export interface UseMailAuthRecordBuilderReturn {
  tab: Ref<MailAuthTab>;
  domain: Ref<string>;
  spf: Ref<SpfConfig>;
  dkim: Ref<DkimConfig>;
  dmarc: Ref<DmarcConfig>;
  spfRecord: Ref<string>;
  dkimRecord: Ref<string>;
  dkimName: Ref<string>;
  dmarcRecord: Ref<string>;
  dmarcName: Ref<string>;
  validateInput: Ref<string>;
  validationIssues: Ref<ValidationIssue[]>;
  validationKind: Ref<'spf' | 'dkim' | 'dmarc' | 'unknown'>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  setTab: (t: MailAuthTab) => void;
}

/** Detect which record type a pasted TXT value is. */
export function detectRecordKind(record: string): 'spf' | 'dkim' | 'dmarc' | 'unknown' {
  const r = record.trim();
  if (/^v=spf1\b/i.test(r)) return 'spf';
  if (/\bv=DMARC1\b/i.test(r)) return 'dmarc';
  if (/\bv=DKIM1\b/i.test(r) || /\bp=[0-9a-zA-Z+/=]/.test(r)) return 'dkim';
  return 'unknown';
}

export function useMailAuthRecordBuilder(): UseMailAuthRecordBuilderReturn {
  const tab = ref<MailAuthTab>('spf');
  const domain = ref<string>('');
  const spf = ref<SpfConfig>({ ...DEFAULT_SPF });
  const dkim = ref<DkimConfig>({ ...DEFAULT_DKIM });
  const dmarc = ref<DmarcConfig>({ ...DEFAULT_DMARC });
  const spfRecord = ref<string>('');
  const dkimRecord = ref<string>('');
  const dkimName = ref<string>('');
  const dmarcRecord = ref<string>('');
  const dmarcName = ref<string>('');
  const validateInput = ref<string>('');
  const validationIssues = ref<ValidationIssue[]>([]);
  const validationKind = ref<'spf' | 'dkim' | 'dmarc' | 'unknown'>('unknown');

  function recompute(): void {
    spfRecord.value = buildSpf(spf.value);
    dkimRecord.value = buildDkim(dkim.value);
    dkimName.value = dkimRecordName({ ...dkim.value, domain: domain.value });
    dmarcRecord.value = buildDmarc(dmarc.value);
    dmarcName.value = dmarcRecordName(domain.value);
  }

  function revalidate(): void {
    const r = validateInput.value.trim();
    if (!r) {
      validationIssues.value = [];
      validationKind.value = 'unknown';
      return;
    }
    const kind = detectRecordKind(r);
    validationKind.value = kind;
    if (kind === 'spf') validationIssues.value = validateSpf(r);
    else if (kind === 'dkim') validationIssues.value = validateDkim(r);
    else if (kind === 'dmarc') validationIssues.value = validateDmarc(r);
    else {
      validationIssues.value = [
        { level: 'error', message: 'Unrecognized record - expected v=spf1, v=DKIM1, or v=DMARC1.' },
      ];
    }
  }

  function setTab(t: MailAuthTab): void {
    tab.value = t;
  }

  watch([spf, dkim, dmarc, domain], recompute, { deep: true, immediate: true });
  watch(validateInput, revalidate, { immediate: true });

  const recordsOutput = computed(() => ({
    spf: spfRecord.value,
    dkim: dkimRecord.value,
    dkimName: dkimName.value,
    dmarc: dmarcRecord.value,
    dmarcName: dmarcName.value,
  }));

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.domain === 'string') domain.value = p.domain;
      if (p.tab === 'spf' || p.tab === 'dkim' || p.tab === 'dmarc') tab.value = p.tab;
      if (typeof p.validate === 'string') validateInput.value = p.validate;
      if (typeof p.spf === 'object' && p.spf !== null) {
        spf.value = { ...DEFAULT_SPF, ...(p.spf as Partial<SpfConfig>) };
      }
      if (typeof p.dkim === 'object' && p.dkim !== null) {
        dkim.value = { ...DEFAULT_DKIM, ...(p.dkim as Partial<DkimConfig>) };
      }
      if (typeof p.dmarc === 'object' && p.dmarc !== null) {
        dmarc.value = { ...DEFAULT_DMARC, ...(p.dmarc as Partial<DmarcConfig>) };
      }
    },
    output: recordsOutput,
    toOutput: () => recordsOutput.value,
  });

  return {
    tab,
    domain,
    spf,
    dkim,
    dmarc,
    spfRecord,
    dkimRecord,
    dkimName,
    dmarcRecord,
    dmarcName,
    validateInput,
    validationIssues,
    validationKind,
    isEmbed,
    embedInput,
    setTab,
  };
}
