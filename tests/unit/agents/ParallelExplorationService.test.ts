import { describe, expect, it, vi } from 'vitest';
import type {
  AgentScheduleInput,
  AgentScheduleResult,
} from '../../../src/agents/AgentSchedulerService';
import {
  type ParallelExplorationScheduler,
  ParallelExplorationService,
} from '../../../src/agents/ParallelExplorationService';

describe('ParallelExplorationService', () => {
  it('should run exploration tasks and merge unique findings', async () => {
    const scheduler: ParallelExplorationScheduler = {
      schedule: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'completed',
          decision: {
            agentName: 'explore',
            confidence: 0.9,
            reason: 'Matched exploration signals.',
          },
          summary: {
            agentName: 'explore',
            success: true,
            findings: ['src/AgentLoop.ts owns orchestration', 'src/ToolManager.ts owns tools'],
          },
        })
        .mockResolvedValueOnce({
          status: 'completed',
          decision: {
            agentName: 'explore',
            confidence: 0.8,
            reason: 'Matched exploration signals.',
          },
          summary: {
            agentName: 'explore',
            success: true,
            findings: ['src/ToolManager.ts owns tools', 'tests cover repair flow'],
          },
        }),
    };
    const service = new ParallelExplorationService({ scheduler });

    const result = await service.run({
      parentRunId: 'agent-run-1',
      agentManager: createAgentManagerStub(),
      tasks: [
        { id: 'map-agent-loop', goal: '分析 AgentLoop 调度链路' },
        { id: 'map-tools', goal: '分析 ToolManager 工具链路' },
      ],
    });

    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.findings).toEqual([
      'src/AgentLoop.ts owns orchestration',
      'src/ToolManager.ts owns tools',
      'tests cover repair flow',
    ]);
    expect(result.summaries).toHaveLength(2);
    expect(scheduler.schedule).toHaveBeenCalledTimes(2);
  });

  it('should respect the configured max concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const scheduler: ParallelExplorationScheduler = {
      schedule: vi.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;

        return {
          status: 'completed',
          decision: {
            agentName: 'explore',
            confidence: 1,
            reason: 'Matched exploration signals.',
          },
          summary: {
            agentName: 'explore',
            success: true,
            findings: ['done'],
          },
        };
      }),
    };
    const service = new ParallelExplorationService({ scheduler });

    await service.run({
      parentRunId: 'agent-run-2',
      agentManager: createAgentManagerStub(),
      maxConcurrency: 2,
      tasks: [
        { id: 'a', goal: '探索 A' },
        { id: 'b', goal: '探索 B' },
        { id: 'c', goal: '探索 C' },
        { id: 'd', goal: '探索 D' },
      ],
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(scheduler.schedule).toHaveBeenCalledTimes(4);
  });

  it('should record skipped and failed tasks without throwing', async () => {
    const scheduler: ParallelExplorationScheduler = {
      schedule: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'skipped',
          reason: 'No suitable subagent was selected.',
        })
        .mockResolvedValueOnce({
          status: 'failed',
          decision: {
            agentName: 'explore',
            confidence: 0.7,
            reason: 'Matched exploration signals.',
          },
          error: 'subagent crashed',
        }),
    };
    const service = new ParallelExplorationService({ scheduler });

    const result = await service.run({
      parentRunId: 'agent-run-3',
      agentManager: createAgentManagerStub(),
      tasks: [
        { id: 'skip-me', goal: '改个变量名' },
        { id: 'fail-me', goal: '探索异常链路' },
      ],
    });

    expect(result.completed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      {
        taskId: 'skip-me',
        status: 'skipped',
        reason: 'No suitable subagent was selected.',
      },
      {
        taskId: 'fail-me',
        status: 'failed',
        agentName: 'explore',
        error: 'subagent crashed',
      },
    ]);
  });

  it('should pass task context and constraints into the scheduler', async () => {
    const scheduler: ParallelExplorationScheduler = {
      schedule: vi.fn(
        async (_input: AgentScheduleInput): Promise<AgentScheduleResult> => ({
          status: 'skipped',
          reason: 'No suitable subagent was selected.',
        })
      ),
    };
    const service = new ParallelExplorationService({ scheduler });

    await service.run({
      parentRunId: 'agent-run-4',
      agentManager: createAgentManagerStub(),
      tasks: [
        {
          id: 'inspect-context',
          goal: '探索上下文注入链路',
          contextSummary: 'Repo map selected context files.',
          constraints: ['Do not edit files.'],
        },
      ],
    });

    expect(scheduler.schedule).toHaveBeenCalledWith({
      parentRunId: 'agent-run-4',
      goal: '探索上下文注入链路',
      contextSummary: 'Repo map selected context files.',
      constraints: ['Do not edit files.'],
      agentManager: expect.any(Object),
    });
  });
});

function createAgentManagerStub() {
  return {
    selectSubagent: vi.fn(),
    delegate: vi.fn(),
  };
}
