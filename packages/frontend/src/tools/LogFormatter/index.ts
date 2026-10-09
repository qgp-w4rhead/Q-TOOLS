/**
 * LogFormatter tool module - exports the lazy-loaded component plus its
 * metadata, composable, and pure helpers.
 *
 * No external dependencies.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'log-formatter',
    name: 'Log Formatter',
    description:
      'Parse and prettify common log formats (Nginx access, Apache, syslog, JSON logs).',
    category: 'devops',
    icon: 'file-text',
    keywords: ['log', 'format', 'prettify', 'nginx', 'apache', 'syslog', 'json', 'parse'],
    dependencies: [],
  },
  () => import('./LogFormatter.vue'),
);

export { metadata };

export {
  useLogFormatter,
  parseLog,
  formatParsedLog,
  detectLogFormat,
  parseNginxLine,
  parseApacheLine,
  parseSyslogLine,
  parseJsonLine,
} from './useLogFormatter';
export type {
  LogFormat,
  ParsedLogEntry,
  LogParseResult,
  UseLogFormatterReturn,
} from './useLogFormatter';

export default component;
