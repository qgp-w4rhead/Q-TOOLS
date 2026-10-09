/**
 * AnsiblePlaybookBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'ansible-playbook-builder',
    name: 'Ansible Playbook Builder',
    description:
      'Form → Ansible playbook YAML (hosts, tasks, handlers, variables).',
    category: 'devops',
    icon: 'file-code',
    keywords: ['ansible', 'playbook', 'yaml', 'tasks', 'handlers', 'variables', 'automation'],
    dependencies: [],
  },
  () => import('./AnsiblePlaybookBuilder.vue'),
);

export { metadata };

export {
  useAnsiblePlaybookBuilder,
  buildPlaybook,
  defaultPlaybookConfig,
} from './useAnsiblePlaybookBuilder';
export type {
  AnsibleTask,
  AnsibleHandler,
  PlaybookConfig,
  UseAnsiblePlaybookBuilderReturn,
} from './useAnsiblePlaybookBuilder';

export default component;
