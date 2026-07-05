import { describe, expect, it, vi } from 'vitest';
import type { BenchmarkReport } from '../../../src/harness/BenchmarkService';
import type { HarnessTaskCatalog } from '../../../src/harness/HarnessTaskCatalogService';
import { RealTaskEvalService } from '../../../src/harness/RealTaskEvalService';
import type { ReleaseGateResult } from '../../../src/harness/ReleaseGateService';

describe('RealTaskEvalService', () => {
  it('should load catalog tasks, run benchmark, and evaluate the release gate', async () => {
    const catalog = createCatalog();
    const benchmarkReport = createBenchmarkReport();
    const gateResult = createGateResult(true);
    const catalogService = {
      load: vi.fn(async () => catalog),
    };
    const benchmarkService = {
      run: vi.fn(async () => benchmarkReport),
    };
    const releaseGateService = {
      evaluate: vi.fn(() => gateResult),
    };
    const service = new RealTaskEvalService({
      catalogService,
      benchmarkService,
      releaseGateService,
    });

    const result = await service.run('/repo/eval/tasks.json');

    expect(catalogService.load).toHaveBeenCalledWith('/repo/eval/tasks.json');
    expect(benchmarkService.run).toHaveBeenCalledWith(catalog.tasks);
    expect(releaseGateService.evaluate).toHaveBeenCalledWith(benchmarkReport);
    expect(result).toEqual({
      version: 1,
      catalogPath: '/repo/eval/tasks.json',
      taskCount: 2,
      benchmark: benchmarkReport,
      gate: gateResult,
      exitCode: 0,
    });
  });

  it('should return a failing exit code when the release gate fails', async () => {
    const service = new RealTaskEvalService({
      catalogService: { load: vi.fn(async () => createCatalog()) },
      benchmarkService: { run: vi.fn(async () => createBenchmarkReport()) },
      releaseGateService: { evaluate: vi.fn(() => createGateResult(false)) },
    });

    const result = await service.run('/repo/eval/tasks.json');

    expect(result.exitCode).toBe(1);
    expect(result.gate.passed).toBe(false);
  });
});

function createCatalog(): HarnessTaskCatalog {
  return {
    version: 1,
    sourcePath: '/repo/eval/tasks.json',
    tasks: [
      {
        id: 'fix-addition',
        title: 'Fix addition',
        category: 'bugfix',
        tags: ['javascript'],
        fixture: './basic-js-repo',
        fixtureDir: '/fixtures/basic-js-repo',
        userMessage: 'Fix addition',
        verificationCommands: ['npm test'],
        expected: { verificationSuccess: true },
      },
      {
        id: 'add-multiply',
        title: 'Add multiply',
        category: 'feature',
        tags: ['javascript'],
        fixture: './basic-js-repo',
        fixtureDir: '/fixtures/basic-js-repo',
        userMessage: 'Add multiply',
        verificationCommands: ['npm test'],
        expected: { verificationSuccess: true },
      },
    ],
  };
}

function createBenchmarkReport(): BenchmarkReport {
  return {
    version: 1,
    startedAt: 1000,
    completedAt: 2000,
    durationMs: 1000,
    threshold: 70,
    summary: {
      totalTasks: 2,
      passedTasks: 2,
      failedTasks: 0,
      averageScore: 95,
      passRate: 100,
    },
    tasks: [],
  };
}

function createGateResult(passed: boolean): ReleaseGateResult {
  return {
    version: 1,
    passed,
    exitCode: passed ? 0 : 1,
    summary: passed ? 'Release gate passed.' : 'Release gate failed.',
    checks: [],
    failedTasks: [],
  };
}
