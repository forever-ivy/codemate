import type { Result, Task } from '../types/index';
import {
  type SubagentDecision,
  type SubagentResultSummary,
  SubagentTaskService,
} from './SubagentTaskService';

export interface AgentSchedulerOptions {
  maxDelegationsPerRun?: number;
}

export interface AgentSchedulerManager {
  selectSubagent(goal: string): SubagentDecision | undefined;
  delegate(task: Task, agentName: string): Promise<Result>;
}

export interface AgentScheduleInput {
  parentRunId: string;
  goal: string;
  contextSummary?: string;
  constraints?: string[];
  agentManager: AgentSchedulerManager;
}

export type AgentScheduleResult =
  | {
      status: 'skipped';
      reason: string;
    }
  | {
      status: 'completed';
      decision: SubagentDecision;
      summary: SubagentResultSummary;
    }
  | {
      status: 'failed';
      decision: SubagentDecision;
      error: string;
    };

/**
 * Runs a bounded, single-subagent delegation step.
 *
 * The scheduler is deliberately small: it does not do parallelism yet. Its job
 * is to enforce delegation limits, invoke AgentManager only after a routing
 * decision exists, and convert subagent output into a parent-readable summary.
 */
export class AgentSchedulerService {
  private subagentTaskService = new SubagentTaskService();
  private delegationCounts = new Map<string, number>();

  constructor(private options: AgentSchedulerOptions = {}) {}

  async schedule(input: AgentScheduleInput): Promise<AgentScheduleResult> {
    if (this.isDelegationLimitReached(input.parentRunId)) {
      return {
        status: 'skipped',
        reason: 'Subagent delegation limit reached for this run.',
      };
    }

    const decision = input.agentManager.selectSubagent(input.goal);
    if (!decision) {
      return {
        status: 'skipped',
        reason: 'No suitable subagent was selected.',
      };
    }

    const task = this.subagentTaskService.buildTask({
      parentRunId: input.parentRunId,
      parentGoal: input.goal,
      decision,
      contextSummary: input.contextSummary,
      constraints: input.constraints,
    });

    this.incrementDelegationCount(input.parentRunId);

    try {
      const result = await input.agentManager.delegate(task, decision.agentName);
      return {
        status: 'completed',
        decision,
        summary: this.subagentTaskService.summarizeResult({
          agentName: decision.agentName,
          result,
        }),
      };
    } catch (error) {
      return {
        status: 'failed',
        decision,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private isDelegationLimitReached(parentRunId: string): boolean {
    const maxDelegations = this.options.maxDelegationsPerRun ?? 1;
    return (this.delegationCounts.get(parentRunId) ?? 0) >= maxDelegations;
  }

  private incrementDelegationCount(parentRunId: string): void {
    const current = this.delegationCounts.get(parentRunId) ?? 0;
    this.delegationCounts.set(parentRunId, current + 1);
  }
}
