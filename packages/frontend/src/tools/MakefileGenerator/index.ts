/**
 * MakefileGenerator tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'makefile-generator',
    name: 'Makefile Generator',
    description:
      'Generate common Makefile targets (build, test, lint, deploy, clean).',
    category: 'devops',
    icon: 'file-text',
    keywords: ['makefile', 'make', 'build', 'test', 'lint', 'deploy', 'clean', 'targets'],
    dependencies: [],
  },
  () => import('./MakefileGenerator.vue'),
);

export { metadata };

export {
  useMakefileGenerator,
  buildMakefile,
  defaultMakefileConfig,
} from './useMakefileGenerator';
export type {
  MakefileTarget,
  MakefileConfig,
  UseMakefileGeneratorReturn,
} from './useMakefileGenerator';

export default component;
