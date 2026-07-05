import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { BenchmarkReport } from '../../../src/harness/BenchmarkService';
import { FailureSampleService } from '../../../src/harness/FailureSampleService';
import type { HarnessTaskDefinition } from '../../../src/harness/HarnessTaskCatalogService';

describe('FailureSampleService', () => {
  const storageDir = path.join(process.cwd(), 'tmp-failure-samples');

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('should capture failed benchmark tasks with repair quality details', async () => {
    const service = createService();

    const samples = await service.capture(createReport(), [createTask()]);

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      id: 'failure-fix-addition-1000',
      taskId: 'fix-addition',
      status: 'open',
      benchmarkScore: 15,
      failureReasons: [
        'task success: Harness task failed.',
        'verification: tests failed',
        'golden trace: 1 golden trace mismatches found.',
      ],
      failedChecks: ['verification success'],
      repairQuality: {
        score: 20,
        grade: 'poor',
      },
    });
    expect(samples[0].repairQuality.dimensions).toEqual([
      expect.objectContaining({ name: 'correctness', score: 0, maxScore: 50 }),
      expect.objectContaining({ name: 'change scope', score: 20, maxScore: 30 }),
      expect.objectContaining({ name: 'regression safety', score: 0, maxScore: 20 }),
    ]);
    await expect(
      fs.access(path.join(storageDir, `${samples[0].id}.json`))
    ).resolves.toBeUndefined();
  });

  it('should mark samples as resolved and filter the sample library', async () => {
    const service = createService();
    const [sample] = await service.capture(createReport(), [createTask()]);

    const resolved = await service.resolve(sample.id, 'Fixed by improving verification context.');
    const openSamples = await service.list({ status: 'open' });
    const resolvedSamples = await service.list({ status: 'resolved', taskId: 'fix-addition' });

    expect(resolved).toMatchObject({
      status: 'resolved',
      resolutionNote: 'Fixed by improving verification context.',
      resolvedAt: 1000,
    });
    expect(openSamples).toEqual([]);
    expect(resolvedSamples).toHaveLength(1);
    expect(resolvedSamples[0].id).toBe(sample.id);
  });

  function createService(): FailureSampleService {
    return new FailureSampleService({
      storageDir,
      now: () => 1000,
      idFactory: (taskId, timestamp) => `failure-${taskId}-${timestamp}`,
    });
  }

  function createTask(): HarnessTaskDefinition {
    return {
      id: 'fix-addition',
      title: 'Fix addition',
      category: 'bugfix',
      tags: ['javascript', 'unit-test'],
      fixture: './basic-js-repo',
      fixtureDir: '/fixtures/basic-js-repo',
      userMessage: 'Fix add and run npm test.',
      verificationCommands: ['npm test'],
      expected: {
        changedFiles: ['src/math.js'],
        verificationSuccess: true,
      },
    };
  }

  function createReport(): BenchmarkReport {
    return {
      version: 1,
      startedAt: 100,
      completedAt: 200,
      durationMs: 100,
      threshold: 70,
      summary: {
        totalTasks: 1,
        passedTasks: 0,
        failedTasks: 1,
        averageScore: 15,
        passRate: 0,
      },
      tasks: [
        {
          taskId: 'fix-addition',
          title: 'Fix addition',
          category: 'bugfix',
          tags: ['javascript', 'unit-test'],
          score: 15,
          passed: false,
          durationMs: 50,
          dimensions: [
            {
              name: 'task success',
              score: 0,
              maxScore: 40,
              applicable: true,
              reason: 'Harness task failed.',
            },
            {
              name: 'harness checks',
              score: 15,
              maxScore: 30,
              applicable: true,
              reason: '1/2 harness checks passed.',
            },
            {
              name: 'verification',
              score: 0,
              maxScore: 20,
              applicable: true,
              reason: 'tests failed',
            },
            {
              name: 'golden trace',
              score: 0,
              maxScore: 10,
              applicable: true,
              reason: '1 golden trace mismatches found.',
            },
          ],
          result: {
            taskId: 'fix-addition',
            title: 'Fix addition',
            success: false,
            workspaceDir: '/tmp/fix-addition',
            checks: [
              {
                name: 'changed file: src/math.js',
                success: true,
                expected: 'src/math.js',
                actual: 'src/math.js, src/unrelated.js',
              },
              {
                name: 'verification success',
                success: false,
                expected: 'true',
                actual: 'false',
              },
            ],
            agentRun: {
              success: false,
              changedFiles: ['src/math.js', 'src/unrelated.js'],
              verification: {
                success: false,
                summary: 'tests failed',
              },
            },
          },
          goldenComparison: {
            taskId: 'fix-addition',
            success: false,
            mismatches: [
              {
                path: 'events[2].data',
                expected: 'read_file',
                actual: 'bash',
              },
            ],
          },
        },
      ],
    };
  }
});
