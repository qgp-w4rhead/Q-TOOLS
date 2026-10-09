/**
 * useHttpRequestTester - composable + pure logic for making HTTP requests.
 *
 * Method/URL/headers/body → fetch → response (status, headers, timing, body).
 *
 * No external dependencies.
 */
import { ref, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RequestConfig {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: { key: string; value: string }[];
  body: string;
  timingMs: number;
  ok: boolean;
}

/* -------------------------------------------------------------------------- */
/* Pure logic                                                                  */
/* -------------------------------------------------------------------------- */

export async function executeRequest(config: RequestConfig): Promise<ResponseData> {
  const startTime = performance.now();

  const headerMap: Record<string, string> = {};
  for (const h of config.headers) {
    if (h.key.trim()) {
      headerMap[h.key.trim()] = h.value;
    }
  }

  const init: RequestInit = {
    method: config.method,
    headers: headerMap,
  };

  if (config.body.trim() && config.method !== 'GET' && config.method !== 'HEAD') {
    init.body = config.body;
  }

  const response = await fetch(config.url, init);
  const timingMs = Math.round(performance.now() - startTime);

  const respHeaders: { key: string; value: string }[] = [];
  response.headers.forEach((value, key) => {
    respHeaders.push({ key, value });
  });

  const body = await response.text();

  return {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
    body,
    timingMs,
    ok: response.ok,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable                                                                  */
/* -------------------------------------------------------------------------- */

export interface UseHttpRequestTesterReturn {
  config: Ref<RequestConfig>;
  response: Ref<ResponseData | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  addHeader: () => void;
  removeHeader: (index: number) => void;
  send: () => Promise<void>;
  reset: () => void;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
}

export function useHttpRequestTester(): UseHttpRequestTesterReturn {
  const config = ref<RequestConfig>({
    method: 'GET',
    url: '',
    headers: [{ key: '', value: '' }],
    body: '',
  });

  const response = ref<ResponseData | null>(null);
  const loading = ref(false);
  const error = ref('');

  function addHeader(): void {
    config.value.headers.push({ key: '', value: '' });
  }

  function removeHeader(index: number): void {
    config.value.headers.splice(index, 1);
    if (config.value.headers.length === 0) {
      config.value.headers.push({ key: '', value: '' });
    }
  }

  async function send(): Promise<void> {
    if (!config.value.url.trim()) {
      error.value = 'URL is required.';
      return;
    }
    loading.value = true;
    error.value = '';
    response.value = null;
    try {
      response.value = await executeRequest(config.value);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    config.value = {
      method: 'GET',
      url: '',
      headers: [{ key: '', value: '' }],
      body: '',
    };
    response.value = null;
    error.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.url === 'string') config.value.url = p.url;
      if (typeof p.method === 'string') config.value.method = p.method as HttpMethod;
      if (typeof p.body === 'string') config.value.body = p.body;
    },
    output: response,
    toOutput: () => ({
      status: response.value?.status,
      body: response.value?.body,
    }),
  });

  return {
    config,
    response,
    loading,
    error,
    addHeader,
    removeHeader,
    send,
    reset,
    isEmbed,
    embedInput,
  };
}
