import type { BenchmarkReport, BenchmarkTaskScore } from './BenchmarkService';
import type { HarnessTaskCategory } from './HarnessTaskCatalogService';

export interface ReleaseGateOptions {
  minPassRate?: number;
  minAverageScore?: number;
  maxFailedTasks?: number;
  maxDurationMs?: number;
  requiredCategories?: HarnessTaskCategory[];
}

export interface ReleaseGateCheck {
  name: 'pass rate' | 'average score' | 'failed tasks' | 'duration' | 'required categories';
  passed: boolean;
  expected: string;
  actual: string;
}

export interface ReleaseGateFailedTask {
  taskId: string;
  title: string;
  category: HarnessTaskCategory;
  score: number;
}

export interface ReleaseGateResult {
  version: 1;
  passed: boolean;
  exitCode: 0 | 1;
  summary: string;
  checks: ReleaseGateCheck[];
  failedTasks: ReleaseGateFailedTask[];
}

/**
 * ReleaseGateService turns benchmark reports into CI-friendly release decisions.
 *
 * BenchmarkService explains task quality. This service applies organization or
 * release-channel thresholds and produces a small pass/fail contract.
 */
export class ReleaseGateService {
  constructor(private options: ReleaseGateOptions = {}) {}

  evaluate(report: BenchmarkReport): ReleaseGateResult {
    const checks = this.createChecks(report);
    const failedTasks = report.tasks
      .filter((task) => !task.passed)
      .map((task) => this.formatFailedTask(task));
    const passed = checks.every((check) => check.passed);

    return {
      version: 1,
      passed,
      exitCode: passed ? 0 : 1,
      summary: this.createSummary(passed, report, checks),
      checks,
      failedTasks,
    };
  }

  private createChecks(report: BenchmarkReport): ReleaseGateCheck[] {
    const checks: ReleaseGateCheck[] = [
      this.thresholdCheck(
        'pass rate',
        report.summary.passRate,
        '>=',
        this.options.minPassRate ?? 80
      ),
      this.thresholdCheck(
        'average score',
        report.summary.averageScore,
        '>=',
        this.options.minAverageScore ?? 80
      ),
      this.thresholdCheck(
        'failed tasks',
        report.summary.failedTasks,
        '<=',
        this.options.maxFailedTasks ?? 0
      ),
    ];

    if (this.options.maxDurationMs !== undefined) {
      checks.push(
        this.thresholdCheck('duration', report.durationMs, '<=', this.options.maxDurationMs)
      );
    }

    if (this.options.requiredCategories?.length) {
      checks.push(this.requiredCategoriesCheck(report, this.options.requiredCategories));
    }

    return checks;
  }

  private thresholdCheck(
    name: ReleaseGateCheck['name'],
    actual: number,
    operator: '>=' | '<=',
    expected: number
  ): ReleaseGateCheck {
    return {
      name,
      passed: operator === '>=' ? actual >= expected : actual <= expected,
      expected: `${operator} ${expected}`,
      actual: this.formatNumber(actual),
    };
  }

  private requiredCategoriesCheck(
    report: BenchmarkReport,
    requiredCategories: HarnessTaskCategory[]
  ): ReleaseGateCheck {
    const actualCategories = Array.from(new Set(report.tasks.map((task) => task.category))).sort();
    const expectedCategories = [...requiredCategories].sort();
    const actualSet = new Set(actualCategories);

    return {
      name: 'required categories',
      passed: expectedCategories.every((category) => actualSet.has(category)),
      expected: expectedCategories.join(', '),
      actual: actualCategories.join(', ') || 'none',
    };
  }

  private formatFailedTask(task: BenchmarkTaskScore): ReleaseGateFailedTask {
    return {
      taskId: task.taskId,
      title: task.title,
      category: task.category,
      score: task.score,
    };
  }

  private createSummary(
    passed: boolean,
    report: BenchmarkReport,
    checks: ReleaseGateCheck[]
  ): string {
    const failedChecks = checks.filter((check) => !check.passed);
    if (passed) {
      return `Release gate passed: ${report.summary.passedTasks}/${report.summary.totalTasks} tasks passed, average score ${this.formatNumber(report.summary.averageScore)}.`;
    }

    return `Release gate failed: ${failedChecks.length} checks failed, ${report.summary.failedTasks} tasks failed.`;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
}
