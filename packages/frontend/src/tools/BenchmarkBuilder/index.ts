/**
 * BenchmarkBuilder tool module - exports the lazy-loaded component plus its
 * metadata and composable so the tool can be registered in the registry and
 * routed dynamically.
 *
 * The tool measures the execution time of user-provided JavaScript code
 * snippets across a configurable number of iterations, reporting average, min,
 * max, median, p95, p99, standard deviation, and ops/sec. No external
 * dependencies - `performance.now()` + `new Function()` only.
 */
import { defineTool } from '@/tools/defineTool';

const { metadata, component } = defineTool(
  {
    slug: 'benchmark-builder',
    name: 'Benchmark builder',
    description: 'Benchmark JavaScript code snippets.',
    category: 'measurement',
    icon: 'gauge',
    keywords: ['benchmark', 'performance', 'measure'],
    dependencies: [],
  },
  () => import('./BenchmarkBuilder.vue'),
);

export { metadata };

export {
  useBenchmarkBuilder,
  parsePositiveInt,
  formatDuration,
  formatNumber,
  percentile,
  computeStats,
  runBenchmark,
  normaliseError,
  PRESETS,
  MAX_ITERATIONS,
  MAX_WARMUP,
} from './useBenchmarkBuilder';
export type {
  BenchmarkInput,
  BenchmarkStats,
  BenchmarkResult,
  BenchmarkError,
  BenchmarkStage,
  BenchmarkOutcome,
  BenchmarkPreset,
  UseBenchmarkBuilderReturn,
} from './useBenchmarkBuilder';

export default component;
