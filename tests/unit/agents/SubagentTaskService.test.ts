import { describe, expect, it } from 'vitest';
import { SubagentTaskService } from '../../../src/agents/SubagentTaskService';

describe('SubagentTaskService', () => {
  const service = new SubagentTaskService();
  const agents = [
    {
      name: 'explore',
      description: '探索代码库结构，识别关键文件',
      whenToUse: '需要理解代码库结构或查找特定功能时使用',
    },
    {
      name: 'plan',
      description: '分析任务需求，制定执行计划',
      whenToUse: '需要分解复杂任务或制定实施方案时使用',
    },
    {
      name: 'general-purpose',
      description: '执行通用任务，调用工具完成工作',
      whenToUse: '执行具体文件操作时使用',
    },
  ];

  it('should select a focused subagent for exploration work', () => {
    const decision = service.select({
      goal: '请分析代码库结构并找出 AgentLoop 相关文件',
      agents,
    });

    expect(decision?.agentName).toBe('explore');
    expect(decision?.confidence).toBeGreaterThan(0);
    expect(decision?.reason).toContain('Matched');
  });

  it('should avoid delegation when no subagent is meaningfully relevant', () => {
    const decision = service.select({
      goal: '把这个变量名改短一点',
      agents,
    });

    expect(decision).toBeUndefined();
  });

  it('should build a bounded handoff task for the selected subagent', () => {
    const task = service.buildTask({
      parentRunId: 'agent-run-1',
      parentGoal: '优化上下文选择',
      decision: {
        agentName: 'explore',
        confidence: 0.8,
        reason: 'Matched repository exploration terms.',
      },
      contextSummary: 'Repo map has selected src/context files.',
      constraints: ['Do not edit files.', 'Return findings only.'],
    });

    expect(task).toEqual({
      type: 'subagent',
      goal: '优化上下文选择',
      context: {
        parentRunId: 'agent-run-1',
        assignedAgent: 'explore',
        selectionReason: 'Matched repository exploration terms.',
        contextSummary: 'Repo map has selected src/context files.',
      },
      constraints: ['Do not edit files.', 'Return findings only.'],
    });
  });

  it('should summarize subagent results as a parent-agent handoff', () => {
    const summary = service.summarizeResult({
      agentName: 'explore',
      result: {
        success: true,
        data: {
          keyFiles: ['src/agents/AgentLoop.ts'],
          summary: 'AgentLoop owns the main orchestration.',
        },
        message: '代码库探索完成',
      },
    });

    expect(summary).toEqual({
      agentName: 'explore',
      success: true,
      message: '代码库探索完成',
      findings: [
        'keyFiles: src/agents/AgentLoop.ts',
        'summary: AgentLoop owns the main orchestration.',
      ],
    });
  });
});
