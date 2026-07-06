import { describe, expect, it } from 'vitest';
import {
  type AgentWorkbenchInput,
  buildAgentWorkbenchViewModel,
} from '../../../src/ui/workbench/AgentWorkbenchViewModel';

describe('AgentWorkbenchViewModel', () => {
  it('should summarize an idle empty workspace', () => {
    const viewModel = buildAgentWorkbenchViewModel(createInput());

    expect(viewModel.phase).toBe('idle');
    expect(viewModel.phaseLabel).toBe('Ready');
    expect(viewModel.activitySummary).toBe('0 messages · no active task');
    expect(viewModel.hint).toBe('Type a request or "/" for commands.');
  });

  it('should show thinking phase while the model is working', () => {
    const viewModel = buildAgentWorkbenchViewModel(
      createInput({
        status: 'thinking',
        isLoading: true,
        messages: [
          { role: 'user', content: '解释 AgentLoop' },
          { role: 'assistant', content: '我先看一下相关文件。' },
        ],
      })
    );

    expect(viewModel.phase).toBe('thinking');
    expect(viewModel.phaseLabel).toBe('Thinking');
    expect(viewModel.activitySummary).toBe('2 messages · no active task');
    expect(viewModel.messageStats).toEqual({
      user: 1,
      assistant: 1,
      tool: 0,
    });
  });

  it('should show acting phase when there is a running task', () => {
    const viewModel = buildAgentWorkbenchViewModel(
      createInput({
        status: 'streaming',
        currentTask: 'Running verification',
        tasks: [
          {
            id: 'tool-1',
            kind: 'verification',
            description: 'pnpm run typecheck',
            status: 'running',
          },
          {
            id: 'tool-2',
            kind: 'tool',
            description: 'read src/agents/AgentLoop.ts',
            status: 'completed',
          },
        ],
      })
    );

    expect(viewModel.phase).toBe('acting');
    expect(viewModel.phaseLabel).toBe('Acting');
    expect(viewModel.activitySummary).toBe('0 messages · 1 running · 1 completed');
    expect(viewModel.currentTask).toBe('Running verification');
  });

  it('should surface blocked phase when a task fails', () => {
    const viewModel = buildAgentWorkbenchViewModel(
      createInput({
        status: 'error',
        tasks: [
          {
            id: 'tool-1',
            kind: 'tool',
            description: 'edit file',
            status: 'failed',
            details: 'requires approval',
          },
        ],
      })
    );

    expect(viewModel.phase).toBe('blocked');
    expect(viewModel.phaseLabel).toBe('Needs attention');
    expect(viewModel.hint).toBe(
      'Review the failed step, approve a tool, or ask the agent to retry.'
    );
  });
});

function createInput(overrides: Partial<AgentWorkbenchInput> = {}): AgentWorkbenchInput {
  return {
    messages: [],
    tasks: [],
    currentTask: '',
    status: 'idle',
    isLoading: false,
    sessionId: 'session-1',
    model: 'deepseek-chat',
    project: 'codemate',
    ...overrides,
  };
}
