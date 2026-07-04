import { describe, expect, it, vi } from 'vitest';
import { AgentSchedulerService } from '../../../src/agents/AgentSchedulerService';

describe('AgentSchedulerService', () => {
  it('should skip scheduling when no subagent is recommended', async () => {
    const agentManager = {
      selectSubagent: vi.fn(() => undefined),
      delegate: vi.fn(),
    };
    const scheduler = new AgentSchedulerService();

    const result = await scheduler.schedule({
      parentRunId: 'agent-run-1',
      goal: '把变量名改短一点',
      agentManager,
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'No suitable subagent was selected.',
    });
    expect(agentManager.delegate).not.toHaveBeenCalled();
  });

  it('should delegate a bounded task and summarize the subagent result', async () => {
    const agentManager = {
      selectSubagent: vi.fn(() => ({
        agentName: 'explore',
        confidence: 0.75,
        reason: 'Matched exploration signals.',
      })),
      delegate: vi.fn(async () => ({
        success: true,
        data: {
          keyFiles: ['src/agents/AgentLoop.ts'],
          summary: 'AgentLoop owns orchestration.',
        },
        message: '探索完成',
      })),
    };
    const scheduler = new AgentSchedulerService();

    const result = await scheduler.schedule({
      parentRunId: 'agent-run-2',
      goal: '分析代码库结构并找出关键文件',
      contextSummary: 'Repo map selected agent files.',
      constraints: ['Do not edit files.'],
      agentManager,
    });

    expect(agentManager.delegate).toHaveBeenCalledWith(
      {
        type: 'subagent',
        goal: '分析代码库结构并找出关键文件',
        context: {
          parentRunId: 'agent-run-2',
          assignedAgent: 'explore',
          selectionReason: 'Matched exploration signals.',
          contextSummary: 'Repo map selected agent files.',
        },
        constraints: ['Do not edit files.'],
      },
      'explore'
    );
    expect(result).toEqual({
      status: 'completed',
      decision: {
        agentName: 'explore',
        confidence: 0.75,
        reason: 'Matched exploration signals.',
      },
      summary: {
        agentName: 'explore',
        success: true,
        message: '探索完成',
        findings: ['keyFiles: src/agents/AgentLoop.ts', 'summary: AgentLoop owns orchestration.'],
      },
    });
  });

  it('should enforce a per-parent-run delegation limit', async () => {
    const agentManager = {
      selectSubagent: vi.fn(() => ({
        agentName: 'explore',
        confidence: 1,
        reason: 'Matched exploration signals.',
      })),
      delegate: vi.fn(async () => ({
        success: true,
        data: { summary: 'done' },
      })),
    };
    const scheduler = new AgentSchedulerService({ maxDelegationsPerRun: 1 });

    await scheduler.schedule({
      parentRunId: 'agent-run-3',
      goal: '分析代码库结构',
      agentManager,
    });
    const second = await scheduler.schedule({
      parentRunId: 'agent-run-3',
      goal: '继续分析代码库结构',
      agentManager,
    });

    expect(second).toEqual({
      status: 'skipped',
      reason: 'Subagent delegation limit reached for this run.',
    });
    expect(agentManager.delegate).toHaveBeenCalledTimes(1);
  });

  it('should return a failed schedule result when delegation throws', async () => {
    const agentManager = {
      selectSubagent: vi.fn(() => ({
        agentName: 'explore',
        confidence: 0.75,
        reason: 'Matched exploration signals.',
      })),
      delegate: vi.fn(async () => {
        throw new Error('subagent crashed');
      }),
    };
    const scheduler = new AgentSchedulerService();

    const result = await scheduler.schedule({
      parentRunId: 'agent-run-4',
      goal: '分析代码库结构',
      agentManager,
    });

    expect(result).toEqual({
      status: 'failed',
      decision: {
        agentName: 'explore',
        confidence: 0.75,
        reason: 'Matched exploration signals.',
      },
      error: 'subagent crashed',
    });
  });
});
