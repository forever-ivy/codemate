import type { Result, Task } from '../types/index';

export interface SubagentInfo {
  name: string;
  description: string;
  whenToUse: string;
}

export interface SubagentSelectionInput {
  goal: string;
  agents: SubagentInfo[];
  minScore?: number;
}

export interface SubagentDecision {
  agentName: string;
  confidence: number;
  reason: string;
}

export interface SubagentTaskInput {
  parentRunId: string;
  parentGoal: string;
  decision: SubagentDecision;
  contextSummary?: string;
  constraints?: string[];
}

export interface SubagentResultSummary {
  agentName: string;
  success: boolean;
  message?: string;
  findings: string[];
}

export interface SubagentResultInput {
  agentName: string;
  result: Result;
}

/**
 * Plans bounded subagent handoffs without executing them.
 *
 * Subagents are most useful for focused exploration, planning or review work.
 * This service decides whether a subagent is relevant, packages a small task
 * with parent-run context, and summarizes the result for the parent agent.
 */
export class SubagentTaskService {
  private expertiseKeywords: Record<string, string[]> = {
    explore: ['探索', '分析', '理解', '代码库', '结构', '查找', '相关文件', '关键文件'],
    plan: ['计划', '规划', '分解', '方案', '步骤', '设计', '实施'],
  };

  select(input: SubagentSelectionInput): SubagentDecision | undefined {
    const scored = input.agents
      .map((agent) => ({ agent, score: this.scoreAgent(input.goal, agent) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const minScore = input.minScore ?? 2;
    if (!best || best.score < minScore) {
      return undefined;
    }

    const confidence = Math.min(1, Number((best.score / 8).toFixed(2)));
    return {
      agentName: best.agent.name,
      confidence,
      reason: `Matched ${best.score} subagent routing signal${best.score === 1 ? '' : 's'} for ${best.agent.name}.`,
    };
  }

  buildTask(input: SubagentTaskInput): Task {
    return {
      type: 'subagent',
      goal: input.parentGoal,
      context: {
        parentRunId: input.parentRunId,
        assignedAgent: input.decision.agentName,
        selectionReason: input.decision.reason,
        contextSummary: input.contextSummary,
      },
      constraints: input.constraints ?? [],
    };
  }

  summarizeResult(input: SubagentResultInput): SubagentResultSummary {
    return {
      agentName: input.agentName,
      success: input.result.success,
      message: input.result.message,
      findings: this.flattenFindings(input.result.data),
    };
  }

  private scoreAgent(goal: string, agent: SubagentInfo): number {
    const goalText = goal.toLowerCase();
    const keywords = this.expertiseKeywords[agent.name] ?? [];

    let score = 0;
    for (const keyword of keywords) {
      if (goalText.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    return score;
  }

  private flattenFindings(data: unknown): string[] {
    if (!data || typeof data !== 'object') {
      return data === undefined || data === null ? [] : [String(data)];
    }

    return Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${this.stringifyFinding(value)}`);
  }

  private stringifyFinding(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
