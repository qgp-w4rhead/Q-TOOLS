/**
 * useCspEvaluator - composable + pure logic for evaluating Content-Security-Policy
 * headers. Parses a CSP string, analyzes directives, detects missing protections,
 * and warns about unsafe-inline and other dangerous patterns.
 *
 * No external dependencies - pure string parsing.
 */
import { ref, watch, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic (no Vue dependency)                                      */
/* -------------------------------------------------------------------------- */

export type CspSeverity = 'danger' | 'warning' | 'info' | 'pass';

export interface CspFinding {
  severity: CspSeverity;
  directive: string;
  message: string;
  recommendation?: string;
}

export interface CspDirective {
  name: string;
  values: string[];
}

export interface CspEvaluation {
  directives: CspDirective[];
  findings: CspFinding[];
  score: number;
  maxScore: number;
  summary: string;
}

export interface UseCspEvaluatorReturn {
  cspInput: Ref<string>;
  evaluation: Ref<CspEvaluation>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const KNOWN_DIRECTIVES = [
  'default-src', 'script-src', 'style-src', 'img-src', 'font-src',
  'connect-src', 'frame-src', 'object-src', 'media-src', 'manifest-src',
  'worker-src', 'child-src', 'base-uri', 'form-action', 'frame-ancestors',
  'plugin-types', 'require-sri-for', 'report-uri', 'report-to',
  'upgrade-insecure-requests', 'block-all-mixed-content',
  'navigate-to', 'prefetch-src', 'sandbox',
];

/* -------------------------------------------------------------------------- */
/* Pure logic - no Vue dependency below this point                             */
/* -------------------------------------------------------------------------- */

export function evaluateCsp(csp: string): CspEvaluation {
  const directives: CspDirective[] = [];
  const findings: CspFinding[] = [];
  let score = 0;
  const maxScore = 10;

  if (!csp.trim()) {
    return {
      directives: [],
      findings: [{ severity: 'danger', directive: '', message: 'No CSP provided.', recommendation: 'Add a Content-Security-Policy header to your responses.' }],
      score: 0,
      maxScore,
      summary: 'No CSP provided.',
    };
  }

  // Parse directives
  const parts = csp.split(';').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/);
    const name = tokens[0] ?? '';
    const values = tokens.slice(1);
    if (name) {
      directives.push({ name, values });
    }
  }

  const directiveMap = new Map<string, CspDirective>();
  for (const d of directives) {
    directiveMap.set(d.name, d);
  }

  // Check for unknown directives
  for (const d of directives) {
    if (!KNOWN_DIRECTIVES.includes(d.name)) {
      findings.push({
        severity: 'info',
        directive: d.name,
        message: `Unknown or deprecated directive: ${d.name}`,
      });
    }
  }

  // Check default-src
  const defaultSrc = directiveMap.get('default-src');
  if (!defaultSrc) {
    findings.push({
      severity: 'warning',
      directive: 'default-src',
      message: 'No default-src directive - all resource types fall back to allowing everything.',
      recommendation: "Add `default-src 'self'` as a baseline.",
    });
  } else {
    score++;
  }

  // Check script-src
  const scriptSrc = directiveMap.get('script-src') ?? defaultSrc;
  if (scriptSrc) {
    const hasUnsafeInline = scriptSrc.values.some((v) => v === "'unsafe-inline'");
    const hasUnsafeEval = scriptSrc.values.some((v) => v === "'unsafe-eval'");
    if (hasUnsafeInline) {
      findings.push({
        severity: 'danger',
        directive: 'script-src',
        message: "'unsafe-inline' in script-src allows inline scripts - defeats XSS protection.",
        recommendation: "Use nonces or hashes instead of 'unsafe-inline'.",
      });
    }
    if (hasUnsafeEval) {
      findings.push({
        severity: 'danger',
        directive: 'script-src',
        message: "'unsafe-eval' in script-src allows eval() - XSS risk.",
        recommendation: "Remove 'unsafe-eval' and refactor code that uses eval().",
      });
    }
    if (!hasUnsafeInline && !hasUnsafeEval) {
      score++;
    }
  } else {
    findings.push({
      severity: 'warning',
      directive: 'script-src',
      message: 'No script-src directive (and no default-src fallback).',
      recommendation: "Add `script-src 'self'` or more specific sources.",
    });
  }

  // Check style-src
  const styleSrc = directiveMap.get('style-src') ?? defaultSrc;
  if (styleSrc) {
    if (styleSrc.values.some((v) => v === "'unsafe-inline'")) {
      findings.push({
        severity: 'warning',
        directive: 'style-src',
        message: "'unsafe-inline' in style-src - CSS injection risk.",
        recommendation: "Use nonces or hashes for styles.",
      });
    } else {
      score++;
    }
  }

  // Check object-src
  const objectSrc = directiveMap.get('object-src') ?? defaultSrc;
  if (objectSrc) {
    if (objectSrc.values.includes("'none'")) {
      score++;
    } else {
      findings.push({
        severity: 'info',
        directive: 'object-src',
        message: 'object-src is not set to none - Flash/plugins may be loaded.',
        recommendation: "Set `object-src 'none'` to block plugins.",
      });
    }
  } else {
    findings.push({
      severity: 'info',
      directive: 'object-src',
      message: 'No object-src directive.',
      recommendation: "Add `object-src 'none'` to block plugins.",
    });
  }

  // Check frame-ancestors
  const frameAncestors = directiveMap.get('frame-ancestors');
  if (frameAncestors) {
    score++;
  } else {
    findings.push({
      severity: 'info',
      directive: 'frame-ancestors',
      message: 'No frame-ancestors directive - clickjacking protection missing.',
      recommendation: "Add `frame-ancestors 'none'` or 'self'.",
    });
  }

  // Check base-uri
  const baseUri = directiveMap.get('base-uri');
  if (baseUri) {
    score++;
  } else {
    findings.push({
      severity: 'info',
      directive: 'base-uri',
      message: 'No base-uri directive - <base> tag injection risk.',
      recommendation: "Add `base-uri 'self'`.",
    });
  }

  // Check form-action
  const formAction = directiveMap.get('form-action');
  if (formAction) {
    score++;
  } else {
    findings.push({
      severity: 'info',
      directive: 'form-action',
      message: 'No form-action directive - forms can submit to any origin.',
      recommendation: "Add `form-action 'self'`.",
    });
  }

  // Check upgrade-insecure-requests
  if (directiveMap.has('upgrade-insecure-requests')) {
    score++;
  } else {
    findings.push({
      severity: 'info',
      directive: 'upgrade-insecure-requests',
      message: 'No upgrade-insecure-requests directive.',
      recommendation: 'Add `upgrade-insecure-requests` to auto-upgrade HTTP to HTTPS.',
    });
  }

  // Check for https-only sources
  const allValues = directives.flatMap((d) => d.values);
  const hasHttp = allValues.some((v) => v.startsWith('http:') && v !== 'http:');
  if (hasHttp) {
    findings.push({
      severity: 'warning',
      directive: '',
      message: 'HTTP sources detected - use HTTPS-only sources.',
      recommendation: 'Replace http: sources with https: equivalents.',
    });
  }

  // Check for wildcard
  const hasWildcard = allValues.some((v) => v === '*');
  if (hasWildcard) {
    findings.push({
      severity: 'danger',
      directive: '',
      message: "Wildcard '*' detected - allows loading from any origin.",
      recommendation: "Replace '*' with specific origins.",
    });
  }

  // Check for data: URIs in script-src
  if (scriptSrc && scriptSrc.values.some((v) => v.startsWith('data:'))) {
    findings.push({
      severity: 'warning',
      directive: 'script-src',
      message: 'data: URIs in script-src - can be used for XSS.',
      recommendation: 'Remove data: from script-src.',
    });
  }

  const dangerCount = findings.filter((f) => f.severity === 'danger').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const summary = dangerCount > 0
    ? `${dangerCount} danger(s), ${warningCount} warning(s) - CSP needs improvement.`
    : warningCount > 0
      ? `${warningCount} warning(s) - CSP is decent but could be improved.`
      : 'CSP looks good - all checks passed.';

  return {
    directives,
    findings,
    score: Math.min(score, maxScore),
    maxScore,
    summary,
  };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                             */
/* -------------------------------------------------------------------------- */

export function useCspEvaluator(): UseCspEvaluatorReturn {
  const cspInput = ref<string>('');
  const evaluation = ref<CspEvaluation>({
    directives: [],
    findings: [],
    score: 0,
    maxScore: 10,
    summary: '',
  });

  function recompute(): void {
    evaluation.value = evaluateCsp(cspInput.value);
  }

  function reset(): void {
    cspInput.value = '';
    recompute();
  }

  watch(cspInput, recompute);

  recompute();

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.csp === 'string') cspInput.value = p.csp;
      if (typeof p.input === 'string') cspInput.value = p.input;
      if (typeof p.value === 'string') cspInput.value = p.value;
      if (typeof p.header === 'string') cspInput.value = p.header;
    },
    output: evaluation,
    toOutput: () => ({
      directives: evaluation.value.directives,
      findings: evaluation.value.findings,
      score: evaluation.value.score,
      maxScore: evaluation.value.maxScore,
      summary: evaluation.value.summary,
    }),
  });

  return {
    cspInput,
    evaluation,
    isEmbed,
    embedInput,
    reset,
  };
}
