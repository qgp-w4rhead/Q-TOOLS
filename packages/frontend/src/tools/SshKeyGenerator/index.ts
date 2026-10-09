/**
 * SshKeyGenerator tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'ssh-key-generator',
    name: 'SSH Key Pair Generator',
    description:
      'Generate an Ed25519 SSH key pair (OpenSSH format) with SHA256 fingerprint, locally via Web Crypto.',
    category: 'security',
    icon: 'key',
    keywords: [
      'ssh', 'key', 'ed25519', 'keygen', 'openssh', 'public key', 'private key',
      'fingerprint', 'ssh-keygen',
    ],
    dependencies: [],
  },
  () => import('./SshKeyGenerator.vue'),
);

export { metadata };

export {
  useSshKeyGenerator,
  generateKeyPair,
  buildPublicKeyLine,
  buildPrivateKeyPem,
  buildOpensshPrivateBlob,
  publicKeyBlob,
  seedFromPkcs8,
  fingerprint,
  ed25519Supported,
  bytesToBase64,
  base64ToPem,
} from './useSshKeyGenerator';
export type {
  SshKeyPair,
  UseSshKeyGeneratorReturn,
} from './useSshKeyGenerator';

export default component;
