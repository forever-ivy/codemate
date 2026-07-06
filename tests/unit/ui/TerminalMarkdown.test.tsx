import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { TerminalMarkdown } from '../../../src/ui/components/TerminalMarkdown';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('TerminalMarkdown', () => {
  it('should render headings, emphasis and lists without raw markdown markers', () => {
    const { lastFrame } = renderMarkdown(
      [
        '## 当前项目上下文',
        '',
        '**简单说：** 这是 `CodeMate` 项目。',
        '',
        '- **天气查询** — 使用 MCP 工具',
      ].join('\n')
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('当前项目上下文');
    expect(output).toContain('简单说：');
    expect(output).toContain('CodeMate');
    expect(output).toContain('天气查询');
    expect(output).not.toContain('##');
    expect(output).not.toContain('**');
    expect(output).not.toContain('`CodeMate`');
  });

  it('should render fenced code without fence markers', () => {
    const { lastFrame } = renderMarkdown('```ts\nconst value = 1;\n```');
    const output = lastFrame() ?? '';

    expect(output).toContain('ts');
    expect(output).toContain('const value = 1;');
    expect(output).not.toContain('```');
  });

  it('should render links as readable labels with their destination', () => {
    const { lastFrame } = renderMarkdown('[Claude Code](https://example.com/docs)');
    const output = lastFrame() ?? '';

    expect(output).toContain('Claude Code');
    expect(output).toContain('https://example.com/docs');
    expect(output).not.toContain('[Claude Code]');
  });
});

function renderMarkdown(content: string) {
  return render(
    <ThemeProvider>
      <TerminalMarkdown content={content} />
    </ThemeProvider>
  );
}
