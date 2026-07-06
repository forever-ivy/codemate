import { describe, expect, it } from 'vitest';
import { buildAgentRunSummary } from '../../../src/ui/workbench/AgentRunSummaryService';

describe('AgentRunSummaryService', () => {
  it('keeps a concise final answer with result, changed files and verification', () => {
    const summary = buildAgentRunSummary({
      schemaVersion: 1,
      runId: 'run-1',
      status: 'completed',
      success: true,
      assistantMessage:
        '已新增用户管理菜单和页面，并保持现有布局风格。\n\n---\n## Task Report\nChanged files: many details',
      changedFiles: ['src/App.tsx', 'src/menu.ts'],
      verification: { success: true, summary: 'typecheck passed', commands: [] },
    });

    expect(summary).toEqual({
      id: 'run-1',
      result: 'completed',
      summary: '已新增用户管理菜单和页面，并保持现有布局风格。',
      changedFiles: ['src/App.tsx', 'src/menu.ts'],
      verification: 'typecheck passed',
      showEvidence: true,
    });
    expect(JSON.stringify(summary)).not.toContain('Task Report');
  });

  it('strips markdown markers from pure answer summaries and hides empty evidence', () => {
    const summary = buildAgentRunSummary({
      schemaVersion: 1,
      runId: 'run-answer',
      status: 'completed',
      success: true,
      assistantMessage:
        '我是 **CodeMate AI CLI** 智能代码助手。当前模型是 `deepseek-reasoner`，提供方是 **DeepSeek**。',
      changedFiles: [],
    });

    expect(summary.summary).toBe(
      '我是 CodeMate AI CLI 智能代码助手。当前模型是 deepseek-reasoner，提供方是 DeepSeek。'
    );
    expect(summary.showEvidence).toBe(false);
  });

  it('uses explicit fallbacks when evidence is absent', () => {
    const summary = buildAgentRunSummary({
      schemaVersion: 1,
      runId: 'run-2',
      status: 'failed',
      success: false,
      assistantMessage: 'failed',
      changedFiles: [],
      error: 'permission denied',
    });

    expect(summary.changedFiles).toEqual([]);
    expect(summary.verification).toBe('Not run');
    expect(summary.showEvidence).toBe(true);
    expect(summary.error).toBe('permission denied');
  });

  it('includes compact telemetry when provided', () => {
    const summary = buildAgentRunSummary(
      {
        schemaVersion: 1,
        runId: 'run-3',
        status: 'completed',
        success: true,
        assistantMessage: 'done',
        changedFiles: ['src/App.tsx'],
      },
      {
        totalDurationMs: 3_500,
        slowestActivity: 'edit(src/App.tsx)',
        slowestDurationMs: 2_500,
        byKind: { tool: 2_500, verification: 900 },
      }
    );

    expect(summary.telemetry).toBe(
      'total 3.5s · slowest edit(src/App.tsx) 2.5s · tool 2.5s, verify 900ms'
    );
  });

  it('includes model token usage when the run has usage data', () => {
    const summary = buildAgentRunSummary({
      schemaVersion: 1,
      runId: 'run-4',
      status: 'completed',
      success: true,
      assistantMessage: 'done',
      changedFiles: ['src/App.tsx'],
      usage: {
        promptTokens: 1_200,
        completionTokens: 340,
        totalTokens: 1_540,
      },
    });

    expect(summary.tokens).toBe('prompt 1.2k · completion 340 · total 1.5k');
  });
});
