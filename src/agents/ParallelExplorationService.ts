import {
  type AgentScheduleInput,
  type AgentScheduleResult,
  type AgentSchedulerManager,
  AgentSchedulerService,
} from './AgentSchedulerService';
import type { SubagentResultSummary } from './SubagentTaskService';

export interface ParallelExplorationTask {
  id: string;
  goal: string;
  contextSummary?: string;
  constraints?: string[];
}

export interface ParallelExplorationInput {
  parentRunId: string;
  tasks: ParallelExplorationTask[];
  agentManager: AgentSchedulerManager;
  maxConcurrency?: number;
}

export interface ParallelExplorationFailure {
  taskId: string;
  status: 'skipped' | 'failed';
  reason?: string;
  agentName?: string;
  error?: string;
}

export interface ParallelExplorationResult {
  parentRunId: string;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  summaries: SubagentResultSummary[];
  findings: string[];
  failures: ParallelExplorationFailure[];
}

export interface ParallelExplorationScheduler {
  schedule(input: AgentScheduleInput): Promise<AgentScheduleResult>;
}

export interface ParallelExplorationOptions {
  scheduler?: ParallelExplorationScheduler;
  defaultMaxConcurrency?: number;
}

/**
 * Runs multiple bounded exploration handoffs and merges their summaries.
 *
 * 调用链路：
 * parent agent -> ParallelExplorationService.run -> AgentSchedulerService.schedule
 *
 * The service does not let one failed subagent crash the whole exploration
 * batch. Each task is converted into a completed / skipped / failed record,
 * then findings are de-duplicated in the order subagent results arrive.
 */
export class ParallelExplorationService {
  private scheduler: ParallelExplorationScheduler;

  constructor(private options: ParallelExplorationOptions = {}) {
    this.scheduler =
      options.scheduler ??
      new AgentSchedulerService({
        // Parallel exploration owns the batch limit. The scheduler still
        // protects each individual handoff, but should not collapse a batch to
        // a single delegation by default.
        maxDelegationsPerRun: Number.MAX_SAFE_INTEGER,
      });
  }

  async run(input: ParallelExplorationInput): Promise<ParallelExplorationResult> {
    const maxConcurrency = this.resolveMaxConcurrency(input.maxConcurrency);
    const taskResults = await this.runWithConcurrency(input, maxConcurrency);
    const summaries = taskResults.flatMap((result) =>
      result.result.status === 'completed' ? [result.result.summary] : []
    );
    const failures = taskResults.flatMap((result) => this.toFailure(result.task, result.result));

    return {
      parentRunId: input.parentRunId,
      total: input.tasks.length,
      completed: summaries.length,
      failed: failures.filter((failure) => failure.status === 'failed').length,
      skipped: failures.filter((failure) => failure.status === 'skipped').length,
      summaries,
      findings: this.mergeFindings(summaries),
      failures,
    };
  }

  private async runWithConcurrency(
    input: ParallelExplorationInput,
    maxConcurrency: number
  ): Promise<Array<{ task: ParallelExplorationTask; result: AgentScheduleResult }>> {
    const results: Array<{ task: ParallelExplorationTask; result: AgentScheduleResult }> = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < input.tasks.length) {
        const task = input.tasks[nextIndex];
        nextIndex += 1;

        results.push({
          task,
          result: await this.scheduler.schedule({
            parentRunId: input.parentRunId,
            goal: task.goal,
            contextSummary: task.contextSummary,
            constraints: task.constraints,
            agentManager: input.agentManager,
          }),
        });
      }
    };

    const workerCount = Math.min(maxConcurrency, input.tasks.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
  }

  private resolveMaxConcurrency(maxConcurrency?: number): number {
    const configured = maxConcurrency ?? this.options.defaultMaxConcurrency ?? 2;
    return Math.max(1, Math.floor(configured));
  }

  private toFailure(
    task: ParallelExplorationTask,
    result: AgentScheduleResult
  ): ParallelExplorationFailure[] {
    if (result.status === 'completed') {
      return [];
    }

    if (result.status === 'skipped') {
      return [
        {
          taskId: task.id,
          status: 'skipped',
          reason: result.reason,
        },
      ];
    }

    return [
      {
        taskId: task.id,
        status: 'failed',
        agentName: result.decision.agentName,
        error: result.error,
      },
    ];
  }

  private mergeFindings(summaries: SubagentResultSummary[]): string[] {
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const summary of summaries) {
      for (const finding of summary.findings) {
        if (seen.has(finding)) {
          continue;
        }
        seen.add(finding);
        merged.push(finding);
      }
    }

    return merged;
  }
}
