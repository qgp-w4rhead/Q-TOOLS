/**
 * JwtParser tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'jwt-parser',
  name: 'JWT parser',
  description: 'Decode and inspect JSON Web Tokens.',
  category: 'web',
  icon: 'key-round',
  keywords: ['jwt', 'token', 'decode', 'header', 'payload', 'signature', 'json', 'jws'],
  dependencies: [],
};

export {
  useJwtParser,
  parseJwt,
  base64UrlDecode,
  decodeJwtPart,
  bytesToHex,
  formatDate,
  checkValidity,
  JwtParseError,
} from './useJwtParser';
export type {
  ParsedJwt,
  JwtPart,
  JwtValidity,
  JwtValidityStatus,
  JwtParseStage,
  UseJwtParserReturn,
} from './useJwtParser';

const JwtParser = defineAsyncComponent(() => import('./JwtParser.vue'));

export default JwtParser;
