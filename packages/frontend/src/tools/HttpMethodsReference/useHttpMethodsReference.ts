/**
 * useHttpMethodsReference — composable + pure logic providing a searchable
 * reference for HTTP methods with safe/idempotent badges.
 *
 * No external dependencies.
 */
import { ref, computed, type ComputedRef, type Ref } from 'vue';
import { useEmbed } from '@/composables/useEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface HttpMethodInfo {
  method: string;
  description: string;
  safe: boolean;
  idempotent: boolean;
  cacheable: boolean;
  hasBody: boolean;
  rfc: string;
}

/* -------------------------------------------------------------------------- */
/* Pure data                                                                   */
/* -------------------------------------------------------------------------- */

export const HTTP_METHODS: HttpMethodInfo[] = [
  { method: 'GET', description: 'Retrieve a representation of the specified resource.', safe: true, idempotent: true, cacheable: true, hasBody: false, rfc: 'RFC 9110 §9.3.1' },
  { method: 'POST', description: 'Submit data to be processed by the target resource.', safe: false, idempotent: false, cacheable: false, hasBody: true, rfc: 'RFC 9110 §9.3.3' },
  { method: 'PUT', description: 'Replace all current representations of the target resource with the request payload.', safe: false, idempotent: true, cacheable: false, hasBody: true, rfc: 'RFC 9110 §9.3.4' },
  { method: 'PATCH', description: 'Apply partial modifications to a resource.', safe: false, idempotent: false, cacheable: false, hasBody: true, rfc: 'RFC 5789' },
  { method: 'DELETE', description: 'Remove the target resource.', safe: false, idempotent: true, cacheable: false, hasBody: false, rfc: 'RFC 9110 §9.3.5' },
  { method: 'HEAD', description: 'Identical to GET but without the response body.', safe: true, idempotent: true, cacheable: true, hasBody: false, rfc: 'RFC 9110 §9.3.2' },
  { method: 'OPTIONS', description: 'Describe communication options for the target resource.', safe: true, idempotent: true, cacheable: false, hasBody: false, rfc: 'RFC 9110 §9.3.7' },
  { method: 'TRACE', description: 'Perform a message loop-back test along the path to the target resource.', safe: true, idempotent: true, cacheable: false, hasBody: false, rfc: 'RFC 9110 §9.3.8' },
  { method: 'CONNECT', description: 'Establish a tunnel to the server identified by the target resource.', safe: false, idempotent: false, cacheable: false, hasBody: false, rfc: 'RFC 9110 §9.3.6' },
];

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

export function searchMethods(query: string): HttpMethodInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return HTTP_METHODS;
  return HTTP_METHODS.filter((m) =>
    m.method.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    m.rfc.toLowerCase().includes(q),
  );
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseHttpMethodsReferenceReturn {
  query: Ref<string>;
  filtered: ComputedRef<HttpMethodInfo[]>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useHttpMethodsReference(): UseHttpMethodsReferenceReturn {
  const query = ref('');

  const filtered = computed(() => searchMethods(query.value));

  const { isEmbed, input: embedInput } = useEmbed({});

  return { query, filtered, isEmbed, embedInput };
}
