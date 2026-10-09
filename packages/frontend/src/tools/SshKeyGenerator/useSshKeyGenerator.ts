/**
 * useSshKeyGenerator - composable + pure logic for the SSH key pair generator
 * tool.
 *
 * Generates an Ed25519 key pair via the Web Crypto API and exports it in
 * OpenSSH formats:
 *  - public:  `ssh-ed25519 <base64> [comment]`
 *  - private: `-----BEGIN OPENSSH PRIVATE KEY-----` (openssh-key-v1,
 *    unencrypted)
 *  - fingerprint: `SHA256:<base64>` of the public-key blob
 *
 * The private key's 32-byte seed is recovered from the PKCS#8 export (fixed
 * DER prefix `302e020100300506032b657004220420` + 32-byte seed). The OpenSSH
 * private blob stores the 64-byte "private key" = seed ‖ public key.
 *
 * Ed25519 in Web Crypto requires a recent browser (Chrome 137+, Firefox 129+,
 * Safari 17+); when unsupported the tool surfaces a clear error.
 *
 * Pure helpers have no Vue dependency and can be imported standalone for
 * unit testing or reuse. The `useSshKeyGenerator()` composable wraps them in
 * reactive state and wires up the embed PostMessage protocol.
 *
 * No external dependencies - Web Crypto only.
 */
import { ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

/** SSH wire `string` = uint32 length + bytes. */
function sshString(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  new DataView(out.buffer).setUint32(0, data.length, false);
  out.set(data, 4);
  return out;
}

const te = new TextEncoder();
function str(s: string): Uint8Array {
  return te.encode(s);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** bytes → standard base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

/** bytes → base64 with PEM line wrapping at 70 chars (OpenSSH convention). */
export function base64ToPem(b64: string, label: string): string {
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 70) lines.push(b64.slice(i, i + 70));
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/** Whether Web Crypto Ed25519 is available in this environment. */
export function ed25519Supported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.generateKey === 'function'
  );
}

/** The PKCS#8 DER prefix for an Ed25519 private key (16 bytes). */
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04,
  0x22, 0x04, 0x20,
]);

/** Extract the 32-byte Ed25519 seed from a PKCS#8 DER export. */
export function seedFromPkcs8(pkcs8: ArrayBuffer): Uint8Array {
  const der = new Uint8Array(pkcs8);
  // Expect: 302e020100 30050603 2b6570 0422 0420 <32-byte seed>
  if (der.length !== PKCS8_ED25519_PREFIX.length + 32) {
    throw new Error('Unexpected PKCS#8 length for Ed25519 key.');
  }
  for (let i = 0; i < PKCS8_ED25519_PREFIX.length; i++) {
    if (der[i] !== PKCS8_ED25519_PREFIX[i]) {
      throw new Error('Unexpected PKCS#8 structure for Ed25519 key.');
    }
  }
  return der.slice(PKCS8_ED25519_PREFIX.length);
}

/** The SSH public-key blob: string("ssh-ed25519") ‖ string(pubkey). */
export function publicKeyBlob(publicKey: Uint8Array): Uint8Array {
  return concat(sshString(str('ssh-ed25519')), sshString(publicKey));
}

/** `ssh-ed25519 <base64> [comment]` public key line. */
export function buildPublicKeyLine(
  publicKey: Uint8Array,
  comment = '',
): string {
  const b64 = bytesToBase64(publicKeyBlob(publicKey));
  return comment.trim()
    ? `ssh-ed25519 ${b64} ${comment.trim()}`
    : `ssh-ed25519 ${b64}`;
}

/**
 * Build the unencrypted OpenSSH private key file body (the base64 payload
 * inside the BEGIN/END markers). Layout per openssh-key-v1:
 *   "openssh-key-v1\0" ‖ ciphername ‖ kdfname ‖ kdfoptions ‖ nkeys ‖
 *   pubkey ‖ encrypted-section
 * With ciphername="none", kdfname="none", the encrypted section is the
 * plaintext: checkint1 ‖ checkint2 ‖ keytype ‖ pubkey ‖ privkey(64) ‖
 * comment ‖ padding(1..blocksize).
 */
export function buildOpensshPrivateBlob(
  publicKey: Uint8Array,
  seed: Uint8Array,
  comment = '',
): Uint8Array {
  const pubBlob = publicKeyBlob(publicKey);
  // Private section: checkint (×2, random), type, pubkey, 64-byte priv, comment, pad.
  const check = new Uint8Array(4);
  crypto.getRandomValues(check);
  const priv64 = concat(seed, publicKey); // OpenSSH stores seed‖pub (64 bytes)
  let plain = concat(
    check,
    check,
    sshString(str('ssh-ed25519')),
    sshString(publicKey),
    sshString(priv64),
    sshString(str(comment)),
  );
  // Pad to multiple of 8 with 1,2,3,…
  const block = 8;
  const padLen = block - (plain.length % block);
  const pad = new Uint8Array(padLen);
  for (let i = 0; i < padLen; i++) pad[i] = i + 1;
  plain = concat(plain, pad);

  return concat(
    str('openssh-key-v1'),
    new Uint8Array([0]),
    sshString(str('none')), // ciphername
    sshString(str('none')), // kdfname
    sshString(new Uint8Array(0)), // kdfoptions
    new Uint8Array([0, 0, 0, 1]), // nkeys = 1
    sshString(pubBlob), // public key blob
    sshString(plain), // (un)encrypted section
  );
}

/** Full `-----BEGIN OPENSSH PRIVATE KEY-----` file text. */
export function buildPrivateKeyPem(
  publicKey: Uint8Array,
  seed: Uint8Array,
  comment = '',
): string {
  const blob = buildOpensshPrivateBlob(publicKey, seed, comment);
  return base64ToPem(bytesToBase64(blob), 'OPENSSH PRIVATE KEY');
}

/** `SHA256:<base64>` fingerprint of the public key (no padding). */
export async function fingerprint(publicKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    publicKeyBlob(publicKey) as BufferSource,
  );
  return `SHA256:${bytesToBase64(new Uint8Array(digest)).replace(/=+$/, '')}`;
}

/** A generated key pair in all display formats. */
export interface SshKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  comment: string;
}

/** Generate a full Ed25519 key pair. Throws when Web Crypto lacks Ed25519. */
export async function generateKeyPair(comment = ''): Promise<SshKeyPair> {
  if (!ed25519Supported()) {
    throw new Error('Web Crypto Ed25519 is not supported in this browser.');
  }
  let keys: CryptoKeyPair;
  try {
    keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ]);
  } catch (e) {
    throw new Error(
      `Ed25519 key generation failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const pubRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keys.publicKey),
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
  const seed = seedFromPkcs8(pkcs8);
  return {
    publicKey: buildPublicKeyLine(pubRaw, comment),
    privateKey: buildPrivateKeyPem(pubRaw, seed, comment),
    fingerprint: await fingerprint(pubRaw),
    comment,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export interface UseSshKeyGeneratorReturn {
  comment: Ref<string>;
  result: Ref<SshKeyPair | null>;
  busy: Ref<boolean>;
  error: Ref<string>;
  supported: Ref<boolean>;
  showPrivate: Ref<boolean>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  generate: () => Promise<void>;
}

export function useSshKeyGenerator(): UseSshKeyGeneratorReturn {
  const comment = ref<string>('');
  const result = ref<SshKeyPair | null>(null);
  const busy = ref<boolean>(false);
  const error = ref<string>('');
  const supported = ref<boolean>(ed25519Supported());
  const showPrivate = ref<boolean>(false);

  async function generate(): Promise<void> {
    error.value = '';
    busy.value = true;
    try {
      result.value = await generateKeyPair(comment.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      result.value = null;
    } finally {
      busy.value = false;
    }
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.comment === 'string') comment.value = p.comment;
      if (p.action === 'generate') void generate();
    },
    output: result,
    toOutput: () => {
      const r = result.value;
      return r
        ? {
            publicKey: r.publicKey,
            privateKey: r.privateKey,
            fingerprint: r.fingerprint,
          }
        : {};
    },
  });

  return {
    comment,
    result,
    busy,
    error,
    supported,
    showPrivate,
    isEmbed,
    embedInput,
    generate,
  };
}
