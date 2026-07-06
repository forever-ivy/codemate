import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AgentRunSummaryList } from '../../../src/ui/components/AgentRunSummaryList';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';
import type { AgentRunSummary } from '../../../src/ui/workbench/AgentRunSummaryService';

describe('AgentRunSummaryList', () => {
  it('renders the latest compact run summary without tool timeline details', () => {
    const summaries: AgentRunSummary[] = [
      {
        id: 'run-1',
        result: 'completed',
        changedFiles: ['src/App.tsx', 'src/menu.ts'],
        verification: 'typecheck passed',
        showEvidence: true,
        tokens: 'prompt 1.2k · completion 340 · total 1.5k',
        telemetry: 'total 3.5s · slowest edit(src/App.tsx) 2.5s · tool 2.5s',
      },
    ];

    const { lastFrame } = renderSummaryList(summaries);
    const output = lastFrame() ?? '';

    expect(output).toContain('✓ Completed');
    expect(output).toContain('Changed src/App.tsx, src/menu.ts');
    expect(output).toContain('Verified typecheck passed');
    expect(output).not.toContain('Tokens:');
    expect(output).not.toContain('Telemetry:');
    expect(output).not.toContain('Activity Timeline');
    expect(output).not.toContain('[TOOL]');
    expect(output).not.toContain('Model execution');
  });

  it('does not keep older summaries in the dynamic terminal tail', () => {
    const summaries: AgentRunSummary[] = [
      {
        id: 'run-1',
        result: 'completed',
        summary: 'older summary',
        changedFiles: [],
        verification: 'passed',
        showEvidence: true,
      },
      {
        id: 'run-2',
        result: 'completed',
        summary: 'latest summary',
        changedFiles: [],
        verification: 'passed',
        showEvidence: true,
      },
    ];

    const { lastFrame } = renderSummaryList(summaries);
    const output = lastFrame() ?? '';

    expect(output).toContain('latest summary');
    expect(output).not.toContain('older summary');
  });

  it('renders empty evidence explicitly', () => {
    const summaries: AgentRunSummary[] = [
      {
        id: 'run-2',
        result: 'failed',
        changedFiles: [],
        verification: 'Not run',
        showEvidence: true,
        error: 'permission denied',
      },
    ];

    const { lastFrame } = renderSummaryList(summaries);
    const output = lastFrame() ?? '';

    expect(output).toContain('✕ Failed');
    expect(output).toContain('Changed No file changes');
    expect(output).toContain('Verified Not run');
    expect(output).toContain('Error: permission denied');
  });

  it('renders pure answers without empty changed files or verification noise', () => {
    const summaries: AgentRunSummary[] = [
      {
        id: 'run-answer',
        result: 'completed',
        summary: '我是 CodeMate AI CLI 智能代码助手。',
        changedFiles: [],
        verification: 'Not run',
        showEvidence: false,
      },
    ];

    const { lastFrame } = renderSummaryList(summaries);
    const output = lastFrame() ?? '';

    expect(output).toContain('✓ Completed');
    expect(output).toContain('我是 CodeMate AI CLI 智能代码助手。');
    expect(output).not.toContain('Changed');
    expect(output).not.toContain('Verified');
  });
});

function renderSummaryList(summaries: AgentRunSummary[]) {
  return render(
    <ThemeProvider>
      <AgentRunSummaryList summaries={summaries} />
    </ThemeProvider>
  );
}
