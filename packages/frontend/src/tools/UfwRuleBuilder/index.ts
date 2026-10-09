/**
 * UfwRuleBuilder tool module.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'ufw-rule-builder',
    name: 'UFW Rule Builder',
    description:
      'Generate UFW firewall commands (allow/deny by port, service, IP, direction).',
    category: 'devops',
    icon: 'flame',
    keywords: ['ufw', 'firewall', 'iptables', 'allow', 'deny', 'port', 'service', 'ip', 'rule'],
    dependencies: [],
  },
  () => import('./UfwRuleBuilder.vue'),
);

export { metadata };

export {
  useUfwRuleBuilder,
  buildUfwCommands,
  defaultUfwConfig,
} from './useUfwRuleBuilder';
export type {
  UfwAction,
  UfwDirection,
  UfwProtocol,
  UfwRule,
  UfwConfig,
  UseUfwRuleBuilderReturn,
} from './useUfwRuleBuilder';

export default component;
