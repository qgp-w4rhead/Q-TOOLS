/**
 * DockerRunToCompose tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers so the tool can be registered in
 * the registry and routed dynamically.
 *
 * No external dependencies beyond `yaml` (part of the initial bundle per
 * tech-stack.md). The docker-run parser itself is hand-rolled.
 */
import { defineAsyncComponent } from 'vue';
import type { ToolMetadata } from '@q-tools/shared';

export const metadata: ToolMetadata = {
  slug: 'docker-run-to-compose',
  name: 'Docker run to Docker compose',
  description:
    'Convert `docker run` commands into a docker-compose.yml file. Parses image, ports, volumes, env, networks, restart, labels, user, workdir, entrypoint and command.',
  category: 'dev',
  icon: 'container',
  keywords: ['docker', 'compose', 'run', 'convert', 'yaml', 'container'],
  dependencies: [],
};

export {
  useDockerRunToCompose,
  tokenize,
  splitSegments,
  parseDockerRun,
  parseInput,
  buildComposeFile,
  composeFileToYaml,
  convertDockerRun,
  deriveServiceName,
} from './useDockerRunToCompose';
export type {
  ComposeService,
  ComposeFile,
  ParsedService,
  ParseResult,
  ConvertResult,
  UseDockerRunToComposeReturn,
} from './useDockerRunToCompose';

const DockerRunToCompose = defineAsyncComponent(
  () => import('./DockerRunToCompose.vue'),
);

export default DockerRunToCompose;
