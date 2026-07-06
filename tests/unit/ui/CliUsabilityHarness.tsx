import type { ToolApprovalRequest } from '@/tools/ToolApprovalRequestService';
import { ThemeProvider } from '@/ui/theme/ThemeSystem';
import { render } from 'ink-testing-library';
import React from 'react';
import { expect } from 'vitest';

const ANSI_STYLE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function renderWithTheme(node: React.ReactElement) {
  return render(React.createElement(ThemeProvider, null, node));
}

/**
 * Normalizes Ink output before usability assertions.
 *
 * The tests in this file intentionally assert semantic terminal content rather
 * than full-screen snapshots. Whitespace and ANSI changes should not break the
 * suite unless the user-visible meaning changes.
 */
export function normalizeTerminalOutput(output: string | undefined): string {
  return (output ?? '')
    .replace(ANSI_STYLE_PATTERN, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function expectNoRawMarkdown(output: string): void {
  expect(output).not.toContain('## ');
  expect(output).not.toContain('**');
  expect(output).not.toContain('```');
}

export function expectWorkbenchShell(output: string): void {
  expect(output).toContain('CodeMate Workbench');
  expect(output).toMatch(/deepseek-chat|test-model|codemate/);
}

export function expectApprovalCard(output: string): void {
  expect(output).toContain('Approval Needed');
  expect(output).toContain('edit_file');
  expect(output).toContain('Risk: write');
  expect(output).toContain('a approve');
  expect(output).toContain('d deny');
  expect(output).toContain('Esc deny');
  expect(output).toContain('no Enter');
}

export function createApprovalRequest(): ToolApprovalRequest {
  return {
    id: 'approval-regression-1',
    toolName: 'edit_file',
    input: {},
    approval: {
      status: 'requires_approval',
      risk: 'write',
      reason: 'edit_file requires user approval in default mode.',
    },
    preview: {
      kind: 'file_diff',
      relativePath: 'src/app.ts',
      beforeExists: true,
      summary: 'File change preview for src/app.ts',
      diff: '- const value = 1;\n+ const value = 2;',
    },
    terminalPreview: '',
    timestamp: 1_000,
  };
}
