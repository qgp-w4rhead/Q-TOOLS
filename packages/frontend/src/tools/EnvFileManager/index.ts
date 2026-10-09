/**
 * EnvFileManager tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'env-file-manager',
    name: 'Env File Manager',
    description:
      '.env ↔ JSON conversion, diff, merge; quote handling, duplicate detection.',
    category: 'devops',
    icon: 'file-cog',
    keywords: ['env', 'dotenv', 'environment', 'variables', 'json', 'convert', 'diff', 'merge'],
    dependencies: [],
  },
  () => import('./EnvFileManager.vue'),
);

export { metadata };

export {
  useEnvFileManager,
  parseEnvFile,
  envEntriesToJson,
  jsonToEnvString,
  diffEnvFiles,
  mergeEnvFiles,
  envEntriesToString,
} from './useEnvFileManager';
export type {
  EnvEntry,
  EnvParseResult,
  EnvMode,
  UseEnvFileManagerReturn,
} from './useEnvFileManager';

export default component;
