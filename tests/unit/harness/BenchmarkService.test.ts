import { describe, expect, it, vi } from 'vitest';
import { BenchmarkService } from '../../../src/harness/BenchmarkService';
import type { HarnessTaskDefinition } from '../../../src/harness/HarnessTaskCatalogService';
import type { MiniHarnessTaskResult } from '../../../src/harness/MiniHarnessService';

describe('BenchmarkService', () => {
  it('should run tasks and calculate explainable benchmark scores', async () => {
    const successfulResult = createResult('fix-addition', true, [true, true], true);
    const failedResult = createResult('add-multiply', false, [true, false], false);
    const runTask = vi
      .fn()
      .mockResolvedValueOnce(successfulResult)
      .mockResolvedValueOnce(failedResult);
    const service = new BenchmarkService(
      { runTask },
      {
        now: createClock([1000, 1010, 1030, 1040]),
        goldenComparisonProvider: async (task) => ({
          taskId: task.id,
          success: task.id === 'fix-addition',
          mismatches:
            task.id === 'fix-addition'
              ? []
              : [
                  {
                    path: 'events[2].data',
                    expected: 'read_file',
                    actual: 'bash',
                  },
                ],
        }),
      }
    );

    const report = await service.run([createTask('fix-addition'), createTask('add-multiply')]);

    expect(report.tasks[0]).toMatchObject({
      taskId: 'fix-addition',
      score: 100,
      passed: true,
      durationMs: 10,
    });
    expect(report.tasks[0].dimensions.map((dimension) => dimension.score)).toEqual([
      40, 30, 20, 10,
    ]);
    expect(report.tasks[1]).toMatchObject({
      taskId: 'add-multiply',
      score: 15,
      passed: false,
      durationMs: 10,
    });
    expect(report.summary).toEqual({
      totalTasks: 2,
      passedTasks: 1,
      failedTasks: 1,
      averageScore: 57.5,
      passRate: 50,
    });
  });

  it('should normalize scores when a golden trace is not available', async () => {
    const result = createResult('fix-addition', true, [true], true);
    const service = new BenchmarkService(
      { runTask: vi.fn(async () => result) },
      {
        now: createClock([1000, 1010]),
      }
    );

    const report = await service.run([createTask('fix-addition')]);
    const goldenDimension = report.tasks[0].dimensions.find(
      (dimension) => dimension.name === 'golden trace'
    );

    expect(report.tasks[0].score).toBe(100);
    expect(goldenDimension).toEqual({
      name: 'golden trace',
      score: 0,
      maxScore: 10,
      applicable: false,
      reason: 'No golden trace comparison was provided.',
    });
  });

  function createTask(id: string): HarnessTaskDefinition {
    return {
      id,
      title: `Task ${id}`,
      category: id === 'fix-addition' ? 'bugfix' : 'feature',
      tags: ['javascript'],
      fixture: './basic-js-repo',
      fixtureDir: '/fixtures/basic-js-repo',
      userMessage: `Run ${id}`,
      verificationCommands: ['npm test'],
      expected: {
        verificationSuccess: true,
      },
    };
  }

  function createResult(
    taskId: string,
    success: boolean,
    checkResults: boolean[],
    verificationSuccess: boolean
  ): MiniHarnessTaskResult {
    return {
      taskId,
      title: `Task ${taskId}`,
      success,
      workspaceDir: `/tmp/${taskId}`,
      checks: checkResults.map((checkSuccess, index) => ({
        name: `check-${index + 1}`,
        success: checkSuccess,
        expected: 'true',
        actual: String(checkSuccess),
      })),
      agentRun: {
        success,
        verification: {
          success: verificationSuccess,
          summary: verificationSuccess ? 'passed' : 'failed',
        },
      },
    };
  }

  function createClock(values: number[]): () => number {
    let index = 0;
    return () => values[index++] ?? values.at(-1) ?? 0;
  }
});
