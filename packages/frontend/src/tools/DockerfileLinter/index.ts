/**
 * DockerfileLinter tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'dockerfile-linter',
    name: 'Dockerfile Linter',
    description:
      'Paste Dockerfile → best-practice checks (layer count, base image, USER, HEALTHCHECK, etc.).',
    category: 'devops',
    icon: 'container',
    keywords: ['dockerfile', 'lint', 'docker', 'best-practice', 'layers', 'healthcheck', 'user', 'base-image'],
    dependencies: [],
  },
  () => import('./DockerfileLinter.vue'),
);

export { metadata };

export {
  useDockerfileLinter,
  lintDockerfile,
} from './useDockerfileLinter';
export type {
  LintSeverity,
  LintRule,
  LintResult,
  UseDockerfileLinterReturn,
} from './useDockerfileLinter';

export default component;
