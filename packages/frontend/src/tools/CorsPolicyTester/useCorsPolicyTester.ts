/**
 * useCorsPolicyTester - composable + pure logic for validating and generating
 * CORS configurations. Generates Access-Control-* headers and tests CORS
 * configurations.
 *
 * No external dependencies - pure string building and validation.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export interface CorsConfig {
  allowedOrigins: string;
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

export interface CorsHeader {
  name: string;
  value: string;
  description: string;
}

export interface CorsAnalysis {
  headers: CorsHeader[];
  issues: string[];
  warnings: string[];
  configText: string;
  nginxText: string;
}

export interface UseCorsPolicyTesterReturn {
  config: Ref<CorsConfig>;
  analysis: Ref<CorsAnalysis>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

export const ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export const COMMON_HEADERS = [
  'Accept',
  'Authorization',
  'Content-Type',
  'X-Requested-With',
  'X-CSRF-Token',
  'Origin',
];

export const DEFAULT_CONFIG: CorsConfig = {
  allowedOrigins: '*',
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  allowCredentials: false,
  maxAge: 86400,
};

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export function analyzeCors(c: CorsConfig): CorsAnalysis {
  const headers: CorsHeader[] = [];
  const issues: string[] = [];
  const warnings: string[] = [];

  // Access-Control-Allow-Origin
  const origins = c.allowedOrigins.trim();
  if (!origins) {
    issues.push('No allowed origins specified.');
  } else {
    headers.push({
      name: 'Access-Control-Allow-Origin',
      value: origins,
      description: 'Specifies which origins may access the resource.',
    });
  }

  // Access-Control-Allow-Methods
  if (c.allowedMethods.length > 0) {
    headers.push({
      name: 'Access-Control-Allow-Methods',
      value: c.allowedMethods.join(', '),
      description: 'Specifies the HTTP methods allowed when accessing the resource.',
    });
  }

  // Access-Control-Allow-Headers
  if (c.allowedHeaders.length > 0) {
    headers.push({
      name: 'Access-Control-Allow-Headers',
      value: c.allowedHeaders.join(', '),
      description: 'Specifies which headers can be used in the actual request.',
    });
  }

  // Access-Control-Expose-Headers
  if (c.exposedHeaders.length > 0) {
    headers.push({
      name: 'Access-Control-Expose-Headers',
      value: c.exposedHeaders.join(', '),
      description: 'Specifies which headers are exposed to the browser.',
    });
  }

  // Access-Control-Allow-Credentials
  if (c.allowCredentials) {
    headers.push({
      name: 'Access-Control-Allow-Credentials',
      value: 'true',
      description: 'Indicates whether the response can be shared with credentials.',
    });
    if (origins === '*') {
      issues.push('Allow-Credentials cannot be true when Allow-Origin is "*" (per CORS spec). Use specific origins instead.');
    }
  }

  // Access-Control-Max-Age
  if (c.maxAge > 0) {
    headers.push({
      name: 'Access-Control-Max-Age',
      value: String(c.maxAge),
      description: 'Indicates how long preflight results can be cached (seconds).',
    });
  }

  // Warnings
  if (origins === '*' && !c.allowCredentials) {
    warnings.push('Allow-Origin "*" permits any site to read responses. Restrict to specific origins in production.');
  }
  if (c.allowedMethods.includes('DELETE') || c.allowedMethods.includes('PUT') || c.allowedMethods.includes('PATCH')) {
    warnings.push('Destructive methods (DELETE/PUT/PATCH) are allowed - ensure proper authentication is enforced.');
  }
  if (c.maxAge === 0) {
    warnings.push('Max-Age 0 disables preflight caching - every request will trigger an OPTIONS preflight.');
  }

  const configText = headers.map((h) => `${h.name}: ${h.value}`).join('\n');
  const nginxText = headers
    .map((h) => `add_header ${h.name} "${h.value.replace(/"/g, '\\"')}" always;`)
    .join('\n');

  return { headers, issues, warnings, configText, nginxText };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useCorsPolicyTester(): UseCorsPolicyTesterReturn {
  const config = ref<CorsConfig>({ ...DEFAULT_CONFIG });
  const analysis = ref<CorsAnalysis>({
    headers: [],
    issues: [],
    warnings: [],
    configText: '',
    nginxText: '',
  });

  function recompute(): void {
    analysis.value = analyzeCors(config.value);
  }

  function reset(): void {
    config.value = { ...DEFAULT_CONFIG };
    recompute();
  }

  watch(config, recompute, { deep: true });

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.config === 'object' && p.config !== null) {
        config.value = { ...DEFAULT_CONFIG, ...(p.config as Partial<CorsConfig>) };
      }
    },
    output: analysis,
    toOutput: () => ({
      headers: analysis.value.headers,
      issues: analysis.value.issues,
      warnings: analysis.value.warnings,
      configText: analysis.value.configText,
    }),
  });

  return {
    config,
    analysis,
    isEmbed,
    embedInput,
    reset,
  };
}
