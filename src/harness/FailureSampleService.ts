import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import type { BenchmarkReport, BenchmarkTaskScore } from './BenchmarkService';
import type { GoldenTraceMismatch } from './GoldenTraceService';
import type { HarnessTaskDefinition } from './HarnessTaskCatalogService';

const qualityDimensionSchema = z.object({
  name: z.enum(['correctness', 'change scope', 'regression safety']),
  score: z.number().nonnegative(),
  maxScore: z.number().positive(),
  applicable: z.boolean(),
  reason: z.string(),
});

const failureSampleSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['bugfix', 'feature', 'refactor', 'test']),
  tags: z.array(z.string()),
  status: z.enum(['open', 'resolved']),
  createdAt: z.number().nonnegative(),
  resolvedAt: z.number().nonnegative().optional(),
  resolutionNote: z.string().min(1).optional(),
  benchmarkScore: z.number().nonnegative(),
  failureReasons: z.array(z.string()),
  failedChecks: z.array(z.string()),
  goldenMismatches: z.array(
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    })
  ),
  verificationSummary: z.string().optional(),
  changedFiles: z.array(z.string()),
  repairQuality: z.object({
    score: z.number().nonnegative(),
    grade: z.enum(['excellent', 'acceptable', 'poor']),
    dimensions: z.array(qualityDimensionSchema),
  }),
});

export type RepairQualityDimension = z.infer<typeof qualityDimensionSchema>;
export type FailureSample = z.infer<typeof failureSampleSchema>;
export type FailureSampleStatus = FailureSample['status'];

export interface FailureSampleFilter {
  status?: FailureSampleStatus;
  taskId?: string;
  category?: FailureSample['category'];
}

export interface FailureSampleOptions {
  storageDir: string;
  now?: () => number;
  idFactory?: (taskId: string, timestamp: number) => string;
}

/**
 * FailureSampleService turns failed benchmark tasks into durable engineering
 * artifacts and evaluates repair quality with deterministic signals.
 */
export class FailureSampleService {
  private now: () => number;
  private idFactory: (taskId: string, timestamp: number) => string;

  constructor(private options: FailureSampleOptions) {
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? ((taskId, timestamp) => `failure-${taskId}-${timestamp}`);
  }

  async capture(report: BenchmarkReport, tasks: HarnessTaskDefinition[]): Promise<FailureSample[]> {
    const taskMap = new Map(tasks.map((task) => [task.id, task]));
    const samples: FailureSample[] = [];

    for (const score of report.tasks.filter((taskScore) => !taskScore.passed)) {
      const task = taskMap.get(score.taskId);
      if (!task) {
        throw new Error(`Harness task definition not found: ${score.taskId}`);
      }

      const sample = this.createSample(task, score);
      await this.save(sample);
      samples.push(sample);
    }

    return samples;
  }

  async save(sample: FailureSample): Promise<void> {
    const parsed = failureSampleSchema.parse(sample);
    this.assertSampleId(parsed.id);
    await fs.mkdir(this.options.storageDir, { recursive: true });

    const targetPath = this.getSamplePath(parsed.id);
    const temporaryPath = `${targetPath}.tmp-${process.pid}-${this.now()}`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
    await fs.rename(temporaryPath, targetPath);
  }

  async load(sampleId: string): Promise<FailureSample> {
    this.assertSampleId(sampleId);
    const content = await fs.readFile(this.getSamplePath(sampleId), 'utf-8');
    const parsed = failureSampleSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsed.success) {
      throw new Error(`Invalid failure sample: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async list(filter: FailureSampleFilter = {}): Promise<FailureSample[]> {
    const entries = await fs.readdir(this.options.storageDir).catch(() => []);
    const samples: FailureSample[] = [];

    for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
      const sample = await this.load(entry.slice(0, -'.json'.length));
      if (filter.status && sample.status !== filter.status) continue;
      if (filter.taskId && sample.taskId !== filter.taskId) continue;
      if (filter.category && sample.category !== filter.category) continue;
      samples.push(sample);
    }

    return samples.sort((left, right) => left.createdAt - right.createdAt);
  }

  async resolve(sampleId: string, resolutionNote: string): Promise<FailureSample> {
    const sample = await this.load(sampleId);
    const resolved: FailureSample = {
      ...sample,
      status: 'resolved',
      resolvedAt: this.now(),
      resolutionNote,
    };
    await this.save(resolved);
    return resolved;
  }

  private createSample(task: HarnessTaskDefinition, score: BenchmarkTaskScore): FailureSample {
    const timestamp = this.now();
    const id = this.idFactory(task.id, timestamp);
    this.assertSampleId(id);

    return {
      version: 1,
      id,
      taskId: task.id,
      title: task.title,
      category: task.category,
      tags: [...task.tags],
      status: 'open',
      createdAt: timestamp,
      benchmarkScore: score.score,
      failureReasons: score.dimensions
        .filter((dimension) => dimension.applicable && dimension.score === 0)
        .map((dimension) => `${dimension.name}: ${dimension.reason}`),
      failedChecks: score.result.checks
        .filter((check) => !check.success)
        .map((check) => check.name),
      goldenMismatches: score.goldenComparison?.mismatches ?? [],
      ...(score.result.agentRun?.verification?.summary
        ? { verificationSummary: score.result.agentRun.verification.summary }
        : {}),
      changedFiles: [...(score.result.agentRun?.changedFiles ?? [])].sort(),
      repairQuality: this.evaluateRepairQuality(task, score),
    };
  }

  private evaluateRepairQuality(
    task: HarnessTaskDefinition,
    score: BenchmarkTaskScore
  ): FailureSample['repairQuality'] {
    const dimensions = [
      this.evaluateCorrectness(score),
      this.evaluateChangeScope(task, score),
      this.evaluateRegressionSafety(score.goldenComparison?.mismatches),
    ];
    const applicable = dimensions.filter((dimension) => dimension.applicable);
    const earned = applicable.reduce((total, dimension) => total + dimension.score, 0);
    const available = applicable.reduce((total, dimension) => total + dimension.maxScore, 0);
    const qualityScore = available > 0 ? this.round((earned / available) * 100) : 0;

    return {
      score: qualityScore,
      grade: qualityScore >= 90 ? 'excellent' : qualityScore >= 70 ? 'acceptable' : 'poor',
      dimensions,
    };
  }

  private evaluateCorrectness(score: BenchmarkTaskScore): RepairQualityDimension {
    const verification = score.result.agentRun?.verification;
    if (!verification) {
      return {
        name: 'correctness',
        score: 0,
        maxScore: 50,
        applicable: false,
        reason: 'No verification result was produced.',
      };
    }

    return {
      name: 'correctness',
      score: verification.success ? 50 : 0,
      maxScore: 50,
      applicable: true,
      reason: verification.summary,
    };
  }

  private evaluateChangeScope(
    task: HarnessTaskDefinition,
    score: BenchmarkTaskScore
  ): RepairQualityDimension {
    const expected = new Set(
      (task.expected.changedFiles ?? []).map((file) => this.normalizePath(file))
    );
    const actual = new Set(
      (score.result.agentRun?.changedFiles ?? []).map((file) => this.normalizePath(file))
    );
    if (expected.size === 0) {
      return {
        name: 'change scope',
        score: 0,
        maxScore: 30,
        applicable: false,
        reason: 'No expected changed files were configured.',
      };
    }

    const matched = Array.from(expected).filter((file) => actual.has(file)).length;
    const precision = actual.size > 0 ? matched / actual.size : 0;
    const recall = matched / expected.size;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      name: 'change scope',
      score: this.round(f1 * 30),
      maxScore: 30,
      applicable: true,
      reason: `${matched}/${expected.size} expected files changed; ${actual.size - matched} unexpected files changed.`,
    };
  }

  private evaluateRegressionSafety(
    mismatches: GoldenTraceMismatch[] | undefined
  ): RepairQualityDimension {
    if (!mismatches) {
      return {
        name: 'regression safety',
        score: 0,
        maxScore: 20,
        applicable: false,
        reason: 'No golden trace comparison was provided.',
      };
    }

    return {
      name: 'regression safety',
      score: mismatches.length === 0 ? 20 : 0,
      maxScore: 20,
      applicable: true,
      reason:
        mismatches.length === 0
          ? 'Replay matched the golden trace.'
          : `${mismatches.length} golden trace mismatches found.`,
    };
  }

  private getSamplePath(sampleId: string): string {
    return path.join(this.options.storageDir, `${sampleId}.json`);
  }

  private assertSampleId(sampleId: string): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(sampleId)) {
      throw new Error(`Invalid failure sample id: ${sampleId}`);
    }
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
