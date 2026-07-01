import type { GoldenTraceComparison } from './GoldenTraceService';
import type { HarnessTaskDefinition } from './HarnessTaskCatalogService';
import type { MiniHarnessService, MiniHarnessTaskResult } from './MiniHarnessService';

export interface BenchmarkScoreDimension {
  name: 'task success' | 'harness checks' | 'verification' | 'golden trace';
  score: number;
  maxScore: number;
  applicable: boolean;
  reason: string;
}

export interface BenchmarkTaskScore {
  taskId: string;
  title: string;
  category: HarnessTaskDefinition['category'];
  tags: string[];
  score: number;
  passed: boolean;
  durationMs: number;
  dimensions: BenchmarkScoreDimension[];
  result: MiniHarnessTaskResult;
  goldenComparison?: GoldenTraceComparison;
}

export interface BenchmarkSummary {
  totalTasks: number;
  passedTasks: number;
  failedTasks: number;
  averageScore: number;
  passRate: number;
}

export interface BenchmarkReport {
  version: 1;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  threshold: number;
  summary: BenchmarkSummary;
  tasks: BenchmarkTaskScore[];
}

export type GoldenComparisonProvider = (
  task: HarnessTaskDefinition,
  result: MiniHarnessTaskResult
) => Promise<GoldenTraceComparison | undefined>;

export interface BenchmarkOptions {
  passThreshold?: number;
  now?: () => number;
  goldenComparisonProvider?: GoldenComparisonProvider;
}

/**
 * BenchmarkService runs catalog tasks and converts deterministic harness
 * signals into explainable scores. It does not call a model directly; the
 * injected MiniHarnessService owns task execution.
 */
export class BenchmarkService {
  private passThreshold: number;
  private now: () => number;

  constructor(
    private harness: Pick<MiniHarnessService, 'runTask'>,
    private options: BenchmarkOptions = {}
  ) {
    this.passThreshold = options.passThreshold ?? 70;
    this.now = options.now ?? Date.now;
  }

  async run(tasks: HarnessTaskDefinition[]): Promise<BenchmarkReport> {
    const scores: BenchmarkTaskScore[] = [];
    let startedAt: number | undefined;
    let completedAt: number | undefined;

    for (const task of tasks) {
      const taskStartedAt = this.now();
      startedAt ??= taskStartedAt;
      const result = await this.runTask(task);
      const taskCompletedAt = this.now();
      completedAt = taskCompletedAt;
      const goldenComparison = await this.options.goldenComparisonProvider?.(task, result);
      scores.push(this.scoreTask(task, result, taskCompletedAt - taskStartedAt, goldenComparison));
    }

    if (startedAt === undefined || completedAt === undefined) {
      const timestamp = this.now();
      startedAt = timestamp;
      completedAt = timestamp;
    }

    return {
      version: 1,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      threshold: this.passThreshold,
      summary: this.createSummary(scores),
      tasks: scores,
    };
  }

  private async runTask(task: HarnessTaskDefinition): Promise<MiniHarnessTaskResult> {
    try {
      return await this.harness.runTask(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        taskId: task.id,
        title: task.title,
        success: false,
        workspaceDir: '',
        checks: [
          {
            name: 'benchmark runner completed',
            success: false,
            expected: 'runner resolves without throwing',
            actual: message,
          },
        ],
        error: message,
      };
    }
  }

  private scoreTask(
    task: HarnessTaskDefinition,
    result: MiniHarnessTaskResult,
    durationMs: number,
    goldenComparison?: GoldenTraceComparison
  ): BenchmarkTaskScore {
    const dimensions = [
      this.scoreTaskSuccess(result),
      this.scoreHarnessChecks(result),
      this.scoreVerification(result),
      this.scoreGoldenTrace(goldenComparison),
    ];
    const applicableDimensions = dimensions.filter((dimension) => dimension.applicable);
    const earnedScore = applicableDimensions.reduce(
      (total, dimension) => total + dimension.score,
      0
    );
    const availableScore = applicableDimensions.reduce(
      (total, dimension) => total + dimension.maxScore,
      0
    );
    const score = availableScore > 0 ? this.round((earnedScore / availableScore) * 100) : 0;

    return {
      taskId: task.id,
      title: task.title,
      category: task.category,
      tags: [...task.tags],
      score,
      passed: score >= this.passThreshold,
      durationMs,
      dimensions,
      result,
      ...(goldenComparison ? { goldenComparison } : {}),
    };
  }

  private scoreTaskSuccess(result: MiniHarnessTaskResult): BenchmarkScoreDimension {
    return {
      name: 'task success',
      score: result.success ? 40 : 0,
      maxScore: 40,
      applicable: true,
      reason: result.success ? 'Harness task completed successfully.' : 'Harness task failed.',
    };
  }

  private scoreHarnessChecks(result: MiniHarnessTaskResult): BenchmarkScoreDimension {
    if (result.checks.length === 0) {
      return {
        name: 'harness checks',
        score: 0,
        maxScore: 30,
        applicable: false,
        reason: 'No harness checks were produced.',
      };
    }

    const passedChecks = result.checks.filter((check) => check.success).length;
    return {
      name: 'harness checks',
      score: this.round((passedChecks / result.checks.length) * 30),
      maxScore: 30,
      applicable: true,
      reason: `${passedChecks}/${result.checks.length} harness checks passed.`,
    };
  }

  private scoreVerification(result: MiniHarnessTaskResult): BenchmarkScoreDimension {
    const verification = result.agentRun?.verification;
    if (!verification) {
      return {
        name: 'verification',
        score: 0,
        maxScore: 20,
        applicable: false,
        reason: 'No verification result was produced.',
      };
    }

    return {
      name: 'verification',
      score: verification.success ? 20 : 0,
      maxScore: 20,
      applicable: true,
      reason: verification.summary,
    };
  }

  private scoreGoldenTrace(comparison: GoldenTraceComparison | undefined): BenchmarkScoreDimension {
    if (!comparison) {
      return {
        name: 'golden trace',
        score: 0,
        maxScore: 10,
        applicable: false,
        reason: 'No golden trace comparison was provided.',
      };
    }

    return {
      name: 'golden trace',
      score: comparison.success ? 10 : 0,
      maxScore: 10,
      applicable: true,
      reason: comparison.success
        ? 'Replay matched the golden trace.'
        : `${comparison.mismatches.length} golden trace mismatches found.`,
    };
  }

  private createSummary(scores: BenchmarkTaskScore[]): BenchmarkSummary {
    const passedTasks = scores.filter((score) => score.passed).length;
    const totalTasks = scores.length;
    const averageScore =
      totalTasks > 0
        ? this.round(scores.reduce((total, score) => total + score.score, 0) / totalTasks)
        : 0;

    return {
      totalTasks,
      passedTasks,
      failedTasks: totalTasks - passedTasks,
      averageScore,
      passRate: totalTasks > 0 ? this.round((passedTasks / totalTasks) * 100) : 0,
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
