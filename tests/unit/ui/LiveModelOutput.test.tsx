import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { LiveModelOutput } from '../../../src/ui/components/LiveModelOutput';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('LiveModelOutput', () => {
  it('should render a running tool label from the active stage', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <LiveModelOutput
          output={
            {
              runId: 'run-1',
              stage: 'tool',
              reasoning: 'Inspecting the sidebar structure',
              text: 'Final response draft',
              toolName: 'edit_file',
            } as any
          }
        />
      </ThemeProvider>
    );

    expect(lastFrame()).toContain('Running edit_file');
    expect(lastFrame()).toContain('Tool is running');
    expect(lastFrame()).not.toContain('Preparing tool: edit_file');
    expect(lastFrame()).not.toContain('Final response draft');
  });

  it('should prefer streamed reasoning and show the reasoning label', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <LiveModelOutput
          output={
            {
              runId: 'run-1',
              stage: 'reasoning',
              reasoning: 'Inspecting the sidebar structure',
              text: 'Final response draft',
              toolName: 'edit_file',
            } as any
          }
        />
      </ThemeProvider>
    );

    expect(lastFrame()).toContain('Thinking');
    expect(lastFrame()).toContain('Inspecting the sidebar structure');
    expect(lastFrame()).not.toContain('Final response draft');
    expect((lastFrame() ?? '').split('\n')).toHaveLength(1);
  });

  it('should not render raw markdown-heavy streaming content', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <LiveModelOutput
          output={{
            runId: 'run-1',
            stage: 'reasoning',
            reasoning:
              '# 当前项目上下文\n\n- **天气查询** — 使用 MCP 工具查询天气和预报\n\n```md\nraw block\n```',
            text: '',
          }}
        />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('Thinking');
    expect(output).toContain('当前项目上下文');
    expect(output).not.toContain('##');
    expect(output).not.toContain('**天气查询**');
    expect(output).not.toContain('```md');
    expect(output.split('\n')).toHaveLength(1);
  });
});
