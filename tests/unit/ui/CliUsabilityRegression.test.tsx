import type { EnhancedMessage } from '@/types/index';
import { AgentWorkbench } from '@/ui/components/AgentWorkbench';
import { EnhancedMessageList } from '@/ui/components/EnhancedMessageList';
import { ToolApprovalCard } from '@/ui/components/ToolApprovalCard';
import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  createApprovalRequest,
  expectApprovalCard,
  expectNoRawMarkdown,
  expectWorkbenchShell,
  normalizeTerminalOutput,
  renderWithTheme,
} from './CliUsabilityHarness';

describe('CLI usability regression', () => {
  it('should render assistant markdown without leaking raw markdown markers', () => {
    const messages: EnhancedMessage[] = [
      {
        uuid: 'assistant-1',
        parentUuid: null,
        role: 'assistant',
        content:
          '## 当前项目上下文\n\n- **天气查询** — 使用 MCP 工具查询天气和预报\n\n```ts\nconst value = 1;\n```',
        timestamp: 1,
      },
    ];

    const { lastFrame } = renderWithTheme(<EnhancedMessageList messages={messages} />);
    const output = normalizeTerminalOutput(lastFrame());

    expect(output).toContain('当前项目上下文');
    expect(output).toContain('天气查询');
    expect(output).toContain('const value = 1;');
    expectNoRawMarkdown(output);
  });

  it('should keep the workbench shell, timeline and input-facing context scannable', () => {
    const { lastFrame } = renderWithTheme(
      <AgentWorkbench
        messages={[
          {
            uuid: 'user-1',
            parentUuid: null,
            role: 'user',
            content: '解释审批流',
            timestamp: 1,
          },
        ]}
        tasks={[
          {
            id: 'verify-1',
            kind: 'verification',
            description: 'Running typecheck verification',
            status: 'running',
          },
        ]}
        currentTask="Running typecheck verification"
        status="streaming"
        isLoading={true}
        sessionId="session-usability"
        model="deepseek-chat"
        project="codemate"
      />
    );
    const output = normalizeTerminalOutput(lastFrame());

    expectWorkbenchShell(output);
    expect(output).toContain('Activity Timeline');
    expect(output).toContain('VERIFY');
    expect(output).toContain('Running typecheck verification');
    expect(output).not.toContain('Previous conversation');
  });

  it('should render live thinking as a compact panel without raw markdown churn', () => {
    const { lastFrame } = renderWithTheme(
      <AgentWorkbench
        messages={[]}
        tasks={[]}
        currentTask=""
        status="thinking"
        isLoading={true}
        sessionId="session-live"
        model="deepseek-reasoner"
        project="codemate"
        liveModelOutput={{
          runId: 'run-1',
          stage: 'reasoning',
          reasoning:
            '# 当前项目上下文\n\n- **天气查询** — 使用 MCP 工具查询天气和预报\n\n```md\nraw block\n```',
          text: '',
        }}
      />
    );
    const output = normalizeTerminalOutput(lastFrame());

    expect(output).toContain('Thinking');
    expect(output).toContain('当前项目上下文');
    expect(output).not.toContain('**天气查询**');
    expect(output).not.toContain('```md');
  });

  it('should bound the visible transcript instead of repainting the full history', () => {
    const messages: EnhancedMessage[] = Array.from({ length: 25 }, (_, index) => ({
      uuid: `message-${index + 1}`,
      parentUuid: index === 0 ? null : `message-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `history message ${index + 1}`,
      timestamp: index + 1,
    }));

    const { lastFrame } = renderWithTheme(
      <AgentWorkbench
        messages={messages}
        tasks={[]}
        currentTask=""
        status="idle"
        isLoading={false}
        sessionId="session-history"
        model="deepseek-chat"
        project="codemate"
      />
    );
    const output = normalizeTerminalOutput(lastFrame());

    expect(output).toContain('Showing latest 20 messages');
    expect(output).toContain('5 older hidden');
    expect(output).not.toMatch(/^.*history message 1$/m);
    expect(output).toContain('history message 25');
  });

  it('should render approval diff cards with stable keyboard affordances', () => {
    const { lastFrame } = renderWithTheme(<ToolApprovalCard request={createApprovalRequest()} />);
    const output = normalizeTerminalOutput(lastFrame());

    expectApprovalCard(output);
    expect(output).toContain('- const value = 1;');
    expect(output).toContain('+ const value = 2;');
  });

  it('should show a compact run summary after completion without live timeline noise', () => {
    const { lastFrame } = renderWithTheme(
      <AgentWorkbench
        messages={[]}
        tasks={[]}
        currentTask=""
        status="idle"
        isLoading={false}
        sessionId="session-summary"
        model="deepseek-chat"
        project="codemate"
        runSummaries={[
          {
            id: 'run-summary',
            result: 'completed',
            changedFiles: ['src/App.tsx', 'src/menu.ts'],
            verification: 'typecheck passed',
            showEvidence: true,
          },
        ]}
      />
    );
    const output = normalizeTerminalOutput(lastFrame());

    expect(output).toContain('✓ Completed');
    expect(output).toContain('Changed src/App.tsx, src/menu.ts');
    expect(output).toContain('Verified typecheck passed');
    expect(output).not.toContain('Activity Timeline');
    expect(output).not.toContain('[TOOL]');
  });
});
