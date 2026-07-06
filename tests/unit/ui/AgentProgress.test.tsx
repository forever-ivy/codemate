/**
 * AgentProgress组件单元测试
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentProgress } from '../../../src/ui/components/AgentProgress';
import { AppContextProvider, useAppContext } from '../../../src/ui/context/AppContext';
import type { Application } from '../../../src/application/Application';
import type {
  ToolUsePart,
  ToolResultPart,
  AgentProgressState,
} from '../../../src/ui/components/AgentProgress/types';

// Mock Application
const mockApp = {
  getContainer: () => ({
    get: () => ({}),
  }),
} as unknown as Application;

// Mock ToolUse
const mockToolUse: ToolUsePart = {
  type: 'tool_use',
  id: 'test-tool-123',
  name: 'task',
  displayName: 'Test Task',
  description: 'Test task description',
  input: {
    subagent_type: 'general',
    description: 'Test agent task',
    prompt: 'Do something useful',
  },
};

// Mock ToolResult
const mockToolResult: ToolResultPart = {
  type: 'tool_result',
  tool_use_id: 'test-tool-123',
  content: JSON.stringify({
    result: {
      isError: false,
      returnDisplay: {
        type: 'agent_result',
        status: 'completed',
        content: 'Task completed successfully',
        stats: {
          toolCalls: 3,
          tokens: { input: 100, output: 200 },
          duration: 5000,
        },
      },
      llmContent: 'Task completed',
    },
  }),
};

// Mock AgentProgressState
const mockProgressState: AgentProgressState = {
  agentId: 'agent-123',
  agentType: 'general',
  prompt: 'Do something useful',
  messages: [
    {
      role: 'user',
      content: 'Test user message',
      timestamp: Date.now(),
    },
    {
      role: 'assistant',
      content: 'Test assistant response',
      timestamp: Date.now(),
    },
  ],
  status: 'running',
  lastUpdate: Date.now(),
  model: 'gpt-4',
};

// Test wrapper component
function TestWrapper({
  children,
  agentProgressMap = {},
}: {
  children: React.ReactNode;
  agentProgressMap?: Record<string, AgentProgressState>;
}) {
  return (
    <AppContextProvider app={mockApp}>
      <AgentProgressSeeder agentProgressMap={agentProgressMap}>{children}</AgentProgressSeeder>
    </AppContextProvider>
  );
}

function AgentProgressSeeder({
  children,
  agentProgressMap,
}: {
  children: React.ReactNode;
  agentProgressMap: Record<string, AgentProgressState>;
}) {
  const { updateAgentProgress } = useAppContext();
  const [seeded, setSeeded] = React.useState(Object.keys(agentProgressMap).length === 0);

  React.useEffect(() => {
    Object.entries(agentProgressMap).forEach(([toolUseId, data]) => {
      updateAgentProgress(toolUseId, data);
    });
    setSeeded(true);
  }, []);

  if (!seeded) {
    return null;
  }

  return <>{children}</>;
}

describe('AgentProgress', () => {
  beforeEach(() => {
    // Reset any global state
  });

  it('should render AgentStarting when no progress data and no result', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <AgentProgress toolUse={mockToolUse} />
      </TestWrapper>
    );

    expect(lastFrame()).toContain('general');
    expect(lastFrame()).toContain('Initializing...');
  });

  it('should render AgentCompletedResult when toolResult is provided', () => {
    const { lastFrame } = render(
      <TestWrapper>
        <AgentProgress toolUse={mockToolUse} toolResult={mockToolResult} />
      </TestWrapper>
    );

    expect(lastFrame()).toContain('general');
    expect(lastFrame()).toContain('Done');
    expect(lastFrame()).toContain('3 tool uses');
    expect(lastFrame()).toContain('300 tokens');
  });

  it('should render AgentInProgress when progress data is running', async () => {
    const agentProgressMap = {
      [mockToolUse.id]: mockProgressState,
    };

    const { lastFrame } = render(
      <TestWrapper agentProgressMap={agentProgressMap}>
        <AgentProgress toolUse={mockToolUse} />
      </TestWrapper>
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('general');
    });

    expect(lastFrame()).toContain('general');
    expect(lastFrame()).toContain('tool uses');
    expect(lastFrame()).toContain('tokens');
  });

  it('should show model information when provided', async () => {
    const toolUseWithModel = {
      ...mockToolUse,
      input: {
        ...mockToolUse.input,
        model: 'gpt-4-turbo',
      },
    };

    const agentProgressMap = {
      [toolUseWithModel.id]: {
        ...mockProgressState,
        model: 'gpt-4-turbo',
      },
    };

    const { lastFrame } = render(
      <TestWrapper agentProgressMap={agentProgressMap}>
        <AgentProgress toolUse={toolUseWithModel} />
      </TestWrapper>
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('gpt-4-turbo');
    });

    expect(lastFrame()).toContain('general');
    expect(lastFrame()).toContain('gpt-4-turbo');
  });

  it('should handle error results correctly', () => {
    const errorResult: ToolResultPart = {
      type: 'tool_result',
      tool_use_id: 'test-tool-123',
      content: JSON.stringify({
        result: {
          isError: true,
          returnDisplay: 'Task failed with error',
          llmContent: 'Error occurred',
        },
      }),
    };

    const { lastFrame } = render(
      <TestWrapper>
        <AgentProgress toolUse={mockToolUse} toolResult={errorResult} />
      </TestWrapper>
    );

    expect(lastFrame()).toContain('Failed');
    expect(lastFrame()).toContain('Error occurred');
  });

  it('should display agent type and description correctly', () => {
    const customToolUse: ToolUsePart = {
      ...mockToolUse,
      input: {
        subagent_type: 'file-explorer',
        description: 'Explore project files',
        prompt: 'Find all TypeScript files',
      },
    };

    const { lastFrame } = render(
      <TestWrapper>
        <AgentProgress toolUse={customToolUse} />
      </TestWrapper>
    );

    expect(lastFrame()).toContain('file-explorer');
    expect(lastFrame()).toContain('Explore project files');
  });
});
