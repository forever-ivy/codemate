import type { BenchmarkReport, BenchmarkService } from './BenchmarkService';
import type { HarnessTaskCatalogService } from './HarnessTaskCatalogService';
import type { ReleaseGateResult, ReleaseGateService } from './ReleaseGateService';

export interface RealTaskEvalServiceDependencies {
  catalogService: Pick<HarnessTaskCatalogService, 'load'>;
  benchmarkService: Pick<BenchmarkService, 'run'>;
  releaseGateService: Pick<ReleaseGateService, 'evaluate'>;
}

export interface RealTaskEvalResult {
  version: 1;
  catalogPath: string;
  taskCount: number;
  benchmark: BenchmarkReport;
  gate: ReleaseGateResult;
  exitCode: 0 | 1;
}

/**
 * RealTaskEvalService composes the eval pipeline:
 * catalog -> benchmark -> release gate.
 *
 * It keeps model execution outside this class. CI can provide a benchmark that
 * uses the headless runner from chapter 117, while unit tests use deterministic
 * fakes.
 */
export class RealTaskEvalService {
  constructor(private deps: RealTaskEvalServiceDependencies) {}

  async run(catalogPath: string): Promise<RealTaskEvalResult> {
    const catalog = await this.deps.catalogService.load(catalogPath);
    const benchmark = await this.deps.benchmarkService.run(catalog.tasks);
    const gate = this.deps.releaseGateService.evaluate(benchmark);

    return {
      version: 1,
      catalogPath,
      taskCount: catalog.tasks.length,
      benchmark,
      gate,
      exitCode: gate.exitCode,
    };
  }
}
