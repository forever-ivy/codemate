import { describe, expect, it } from 'vitest';
import type { BenchmarkReport, BenchmarkTaskScore } from '../../../src/harness/BenchmarkService';
import { ReleaseGateService } from '../../../src/harness/ReleaseGateService';

describe('ReleaseGateService', () => {
  it('should pass when benchmark report satisfies release thresholds', () => {
    const service = new ReleaseGateService({
      minPassRate: 80,
      minAverageScore: 85,
      maxFailedTasks: 1,
      maxDurationMs: 60_000,
      requiredCategories: ['bugfix', 'feature'],
    });

    const result = service.evaluate(
      createReport([
        createTaskScore('fix-addition', 'bugfix', true, 100),
        createTaskScore('add-multiply', 'feature', true, 90),
      ])
    );

    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.summary).toContain('Release gate passed');
  });

  it('should fail with explainable checks and failed task summaries', () => {
    const service = new ReleaseGateService({
      minPassRate: 80,
      minAverageScore: 85,
      maxFailedTasks: 0,
      maxDurationMs: 10_000,
      requiredCategories: ['bugfix', 'feature'],
    });

    const result = service.evaluate(
      createReport(
        [
          createTaskScore('fix-addition', 'bugfix', true, 100),
          createTaskScore('add-multiply', 'feature', false, 45),
        ],
        { durationMs: 12_000 }
      )
    );

    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.failedTasks).toEqual([
      {
        taskId: 'add-multiply',
        title: 'Task add-multiply',
        category: 'feature',
        score: 45,
      },
    ]);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'pass rate',
          passed: false,
          actual: '50',
          expected: '>= 80',
        }),
        expect.objectContaining({
          name: 'duration',
          passed: false,
          actual: '12000',
          expected: '<= 10000',
        }),
      ])
    );
  });

  it('should fail when a required task category is missing', () => {
    const service = new ReleaseGateService({
      requiredCategories: ['bugfix', 'feature', 'refactor'],
    });

    const result = service.evaluate(
      createReport([
        createTaskScore('fix-addition', 'bugfix', true, 100),
        createTaskScore('add-multiply', 'feature', true, 95),
      ])
    );

    expect(result.passed).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        name: 'required categories',
        passed: false,
        actual: 'bugfix, feature',
        expected: 'bugfix, feature, refactor',
      })
    );
  });
});

function createReport(
  tasks: BenchmarkTaskScore[],
  overrides: Partial<Pick<BenchmarkReport, 'durationMs'>> = {}
): BenchmarkReport {
  const passedTasks = tasks.filter((task) => task.passed).length;
  const totalTasks = tasks.length;
  const averageScore =
    totalTasks > 0 ? tasks.reduce((total, task) => total + task.score, 0) / totalTasks : 0;

  return {
    version: 1,
    startedAt: 1000,
    completedAt: 2000,
    durationMs: overrides.durationMs ?? 1000,
    threshold: 70,
    summary: {
      totalTasks,
      passedTasks,
      failedTasks: totalTasks - passedTasks,
      averageScore,
      passRate: totalTasks > 0 ? (passedTasks / totalTasks) * 100 : 0,
    },
    tasks,
  };
}

function createTaskScore(
  taskId: string,
  category: BenchmarkTaskScore['category'],
  passed: boolean,
  score: number
): BenchmarkTaskScore {
  return {
    taskId,
    title: `Task ${taskId}`,
    category,
    tags: ['unit'],
    score,
    passed,
    durationMs: 100,
    dimensions: [],
    result: {
      taskId,
      title: `Task ${taskId}`,
      success: passed,
      workspaceDir: `/tmp/${taskId}`,
      checks: [],
    },
  };
}
