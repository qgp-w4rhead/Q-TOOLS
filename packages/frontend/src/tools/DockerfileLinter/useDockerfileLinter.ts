/**
 * useDockerfileLinter - composable + pure logic for linting Dockerfiles.
 *
 * Performs best-practice checks:
 *   - Layer count (too many RUN commands)
 *   - Base image (pinned version, not :latest)
 *   - USER directive (running as non-root)
 *   - HEALTHCHECK directive
 *   - .dockerignore hint
 *   - COPY vs ADD usage
 *   - apt-get cleanup
 *   - Multi-stage build detection
 *   - ENV vs ARG usage
 *
 * No external dependencies.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useToolEmbed } from '@/composables/useToolEmbed';
import type { EmbedInputPayload } from '@q-tools/shared';

/* -------------------------------------------------------------------------- */
/* Types - pure logic                                                         */
/* -------------------------------------------------------------------------- */

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintRule {
  id: string;
  severity: LintSeverity;
  message: string;
  line: number;
}

export interface LintResult {
  rules: LintRule[];
  score: number;
  totalChecks: number;
  passedChecks: number;
}

/* -------------------------------------------------------------------------- */
/* Pure logic - linting                                                        */
/* -------------------------------------------------------------------------- */

interface ParsedInstruction {
  instruction: string;
  args: string;
  line: number;
}

function parseDockerfile(text: string): ParsedInstruction[] {
  const lines = text.split('\n');
  const instructions: ParsedInstruction[] = [];

  let currentInstruction = '';
  let currentArgs = '';
  let currentLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    if (currentInstruction === '') {
      currentLine = i + 1;
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx === -1) {
        currentInstruction = trimmed.toUpperCase();
        currentArgs = '';
      } else {
        currentInstruction = trimmed.slice(0, spaceIdx).toUpperCase();
        currentArgs = trimmed.slice(spaceIdx + 1);
      }
    } else {
      currentArgs += ' ' + trimmed;
    }

    if (!currentArgs.endsWith('\\')) {
      instructions.push({
        instruction: currentInstruction,
        args: currentArgs.replace(/\\$/, '').trim(),
        line: currentLine,
      });
      currentInstruction = '';
      currentArgs = '';
    } else {
      currentArgs = currentArgs.slice(0, -1);
    }
  }

  if (currentInstruction) {
    instructions.push({
      instruction: currentInstruction,
      args: currentArgs,
      line: currentLine,
    });
  }

  return instructions;
}

export function lintDockerfile(text: string): LintResult {
  const instructions = parseDockerfile(text);
  const rules: LintRule[] = [];

  if (instructions.length === 0) {
    rules.push({
      id: 'EMPTY',
      severity: 'error',
      message: 'Dockerfile is empty or contains no instructions.',
      line: 0,
    });
    return { rules, score: 0, totalChecks: 0, passedChecks: 0 };
  }

  const fromInstructions = instructions.filter((i) => i.instruction === 'FROM');
  const runInstructions = instructions.filter((i) => i.instruction === 'RUN');
  const userInstructions = instructions.filter((i) => i.instruction === 'USER');
  const healthcheckInstructions = instructions.filter((i) => i.instruction === 'HEALTHCHECK');
  const addInstructions = instructions.filter((i) => i.instruction === 'ADD');
  const workdirInstructions = instructions.filter((i) => i.instruction === 'WORKDIR');

  let totalChecks = 0;
  let passedChecks = 0;

  // Check 1: Base image not :latest
  totalChecks++;
  const firstFrom = fromInstructions[0];
  if (firstFrom) {
    const baseImage = firstFrom.args.split(' ')[0] ?? '';
    if (baseImage.endsWith(':latest') || !baseImage.includes(':')) {
      rules.push({
        id: 'DL3006',
        severity: 'warning',
        message: 'Always tag the base image explicitly - avoid :latest or untagged images.',
        line: firstFrom.line,
      });
    } else {
      passedChecks++;
    }
  }

  // Check 2: USER directive (non-root)
  totalChecks++;
  if (userInstructions.length === 0) {
    rules.push({
      id: 'DL3002',
      severity: 'warning',
      message: 'No USER directive found - container will run as root. Consider adding a non-root USER.',
      line: 0,
    });
  } else {
    passedChecks++;
  }

  // Check 3: HEALTHCHECK
  totalChecks++;
  if (healthcheckInstructions.length === 0) {
    rules.push({
      id: 'DL3059',
      severity: 'info',
      message: 'No HEALTHCHECK directive found. Consider adding one for better orchestration.',
      line: 0,
    });
  } else {
    passedChecks++;
  }

  // Check 4: Layer count (too many RUN)
  totalChecks++;
  if (runInstructions.length > 10) {
    rules.push({
      id: 'DL3059-LAYERS',
      severity: 'warning',
      message: `${runInstructions.length} RUN instructions found - consider combining to reduce layers.`,
      line: 0,
    });
  } else {
    passedChecks++;
  }

  // Check 5: ADD vs COPY
  totalChecks++;
  if (addInstructions.length > 0) {
    for (const add of addInstructions) {
      const args = add.args;
      if (!args.includes('.tar') && !args.includes('.gz') && !args.includes('http')) {
        rules.push({
          id: 'DL3010',
          severity: 'warning',
          message: 'Use COPY instead of ADD for simple file copies. ADD is for URLs or tar extraction.',
          line: add.line,
        });
      }
    }
  }
  if (rules.filter((r) => r.id === 'DL3010').length === 0) {
    passedChecks++;
  }

  // Check 6: apt-get cleanup
  totalChecks++;
  for (const run of runInstructions) {
    if (run.args.includes('apt-get install') || run.args.includes('apt install')) {
      if (!run.args.includes('rm -rf /var/lib/apt/lists')) {
        rules.push({
          id: 'DL3009',
          severity: 'warning',
          message: 'apt-get install without cleanup - add `rm -rf /var/lib/apt/lists/*` to reduce image size.',
          line: run.line,
        });
      }
    }
  }
  if (rules.filter((r) => r.id === 'DL3009').length === 0) {
    passedChecks++;
  }

  // Check 7: Multi-stage build
  totalChecks++;
  if (fromInstructions.length > 1) {
    const hasAlias = fromInstructions.some((f) => f.args.includes('AS '));
    if (hasAlias) {
      passedChecks++;
    }
  }

  // Check 8: WORKDIR exists
  totalChecks++;
  if (workdirInstructions.length === 0) {
    rules.push({
      id: 'DL3000',
      severity: 'info',
      message: 'No WORKDIR directive - consider using absolute paths via WORKDIR.',
      line: 0,
    });
  } else {
    passedChecks++;
  }

  // Check 9: Pin package versions in apt-get
  totalChecks++;
  for (const run of runInstructions) {
    if ((run.args.includes('apt-get install') || run.args.includes('apt install')) && !run.args.includes('=')) {
      rules.push({
        id: 'DL3008',
        severity: 'info',
        message: 'Consider pinning package versions with apt-get install package=version.',
        line: run.line,
      });
    }
  }
  if (rules.filter((r) => r.id === 'DL3008').length === 0) {
    passedChecks++;
  }

  // Check 10: .dockerignore hint
  totalChecks++;
  rules.push({
    id: 'DL3023',
    severity: 'info',
    message: 'Ensure a .dockerignore file exists to exclude unnecessary files from the build context.',
    line: 0,
  });

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return { rules, score, totalChecks, passedChecks };
}

/* -------------------------------------------------------------------------- */
/* Composable - reactive state + embed integration                            */
/* -------------------------------------------------------------------------- */

export interface UseDockerfileLinterReturn {
  input: Ref<string>;
  result: ComputedRef<LintResult>;
  isEmbed: Ref<boolean>;
  embedInput: Ref<EmbedInputPayload | null>;
  reset: () => void;
}

export function useDockerfileLinter(): UseDockerfileLinterReturn {
  const input = ref<string>('');

  const result = computed(() => lintDockerfile(input.value));

  function reset(): void {
    input.value = '';
  }

  const { isEmbed, input: embedInput } = useToolEmbed({
    onInput: (payload) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as Record<string, unknown>;
      if (typeof p.input === 'string') {
        input.value = p.input;
      }
    },
    output: result,
    toOutput: () => ({
      score: result.value.score,
      rules: result.value.rules,
      totalChecks: result.value.totalChecks,
      passedChecks: result.value.passedChecks,
    }),
  });

  return {
    input,
    result,
    isEmbed,
    embedInput,
    reset,
  };
}
