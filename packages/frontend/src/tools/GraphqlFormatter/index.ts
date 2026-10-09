/**
 * GraphqlFormatter tool module — exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'graphql-query-formatter',
    name: 'GraphQL Query Formatter',
    description:
      'Prettify and validate GraphQL queries/mutations/subscriptions.',
    category: 'api',
    icon: 'braces',
    keywords: ['graphql', 'query', 'mutation', 'subscription', 'format', 'prettify', 'validate', 'gql'],
    dependencies: [],
  },
  () => import('./GraphqlFormatter.vue'),
);

export { metadata };

export {
  useGraphqlFormatter,
  formatGraphql,
} from './useGraphqlFormatter';
export type {
  FormatResult,
  UseGraphqlFormatterReturn,
} from './useGraphqlFormatter';

export default component;
