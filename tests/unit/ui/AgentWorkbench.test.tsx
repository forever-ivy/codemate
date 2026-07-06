import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AgentWorkbench } from '../../../src/ui/components/AgentWorkbench';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('AgentWorkbench', () => {
  it('should render a stable terminal workbench shell', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentWorkbench
          messages={[
            {
              uuid: 'message-1',
              parentUuid: null,
              role: 'user',
              content: '解释 AgentLoop',
              timestamp: 1,
            },
          ]}
          tasks={[
            {
              id: 'tool-1',
              kind: 'verification',
              description: 'Running verification',
              status: 'running',
            },
          ]}
          currentTask="Running verification"
          status="streaming"
          isLoading={true}
          sessionId="session-123456"
          model="deepseek-chat"
          project="codemate"
        />
      </ThemeProvider>
    );

    expect(lastFrame()).toContain('CodeMate Workbench');
    expect(lastFrame()).toContain('Acting');
    expect(lastFrame()).toContain('Activity Timeline');
    expect(lastFrame()).toContain('VERIFY');
    expect(lastFrame()).toContain('Running verification');
    expect(lastFrame()).toContain('1 message');
  });

  it('should render completed run summaries without the live timeline', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentWorkbench
          messages={[]}
          tasks={[]}
          currentTask=""
          status="idle"
          isLoading={false}
          sessionId="session-123456"
          model="deepseek-chat"
          project="codemate"
          runSummaries={[
            {
              id: 'run-1',
              result: 'completed',
              summary: 'Added the requested navigation entry.',
              changedFiles: ['src/App.tsx'],
              verification: 'typecheck passed',
              showEvidence: true,
            },
          ]}
        />
      </ThemeProvider>
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('✓ Completed');
    expect(output).toContain('Added the requested navigation entry.');
    expect(output).toContain('Changed src/App.tsx');
    expect(output).toContain('Verified typecheck passed');
    expect(output).not.toContain('Activity Timeline');
  });

  it('should keep the active user request above live progress', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentWorkbench
          messages={[
            {
              uuid: 'user-active',
              parentUuid: null,
              role: 'user',
              content: '优化左侧导航菜单',
              timestamp: 1,
            },
          ]}
          tasks={[
            {
              id: 'tool-1',
              kind: 'tool',
              description: 'edit(src/App.tsx)',
              status: 'completed',
              startTime: 1_000,
              endTime: 1_050,
            },
            {
              id: 'tool-2',
              kind: 'tool',
              description: 'bash(npx tsc --noEmit)',
              status: 'running',
              startTime: 1_100,
            },
          ]}
          currentTask="bash(npx tsc --noEmit)"
          status="streaming"
          isLoading={true}
          sessionId="session-123456"
          model="deepseek-reasoner"
          project="vite-project"
          pendingApproval={{
            id: 'approval-1',
            toolName: 'bash',
            input: {},
            approval: {
              status: 'requires_approval',
              risk: 'execute',
              reason: 'bash requires user approval in autoEdit mode.',
            },
            preview: {
              kind: 'none',
              beforeExists: false,
              summary: 'No preview available for this tool call.',
            },
            terminalPreview: '',
            timestamp: 1_200,
          }}
          liveModelOutput={{
            runId: 'run-1',
            stage: 'text',
            reasoning: '',
            text: '我将先检查导航结构，然后修改侧边栏样式。',
          }}
          dynamicMessageStartIndex={0}
        />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    const userIndex = output.indexOf('优化左侧导航菜单');
    const timelineIndex = output.indexOf('Activity Timeline');
    const respondingIndex = output.indexOf('Responding');

    expect(userIndex).toBeGreaterThanOrEqual(0);
    expect(timelineIndex).toBeGreaterThan(userIndex);
    expect(respondingIndex).toBeGreaterThan(timelineIndex);
    expect(output).not.toContain('Approval Needed');
  });

  it('should pause animated activity while the user is typing', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentWorkbench
          messages={[]}
          tasks={[
            {
              id: 'tool-1',
              kind: 'tool',
              description: 'edit(src/App.tsx)',
              status: 'running',
              startTime: 1_000,
            },
          ]}
          currentTask="edit(src/App.tsx)"
          status="streaming"
          isLoading={true}
          model="deepseek-reasoner"
          project="vite-project"
          inputDraftActive={true}
        />
      </ThemeProvider>
    );

    const output = lastFrame() ?? '';
    expect(output).not.toContain('Processing...');
    expect(output).not.toContain('Activity Timeline');
  });

  it('should not render a duplicate processing indicator during live model output', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentWorkbench
          messages={[]}
          tasks={[]}
          status="streaming"
          isLoading={true}
          model="deepseek-reasoner"
          project="vite-project"
          liveModelOutput={{
            runId: 'run-1',
            stage: 'reasoning',
            reasoning: 'Inspecting project files',
            text: '',
          }}
        />
      </ThemeProvider>
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('Thinking');
    expect(output).not.toContain('Processing...');
  });
});
