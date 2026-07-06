import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import type { ToolApprovalRequest } from '../../../src/tools/ToolApprovalRequestService';
import { ToolApprovalCard } from '../../../src/ui/components/ToolApprovalCard';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('ToolApprovalCard', () => {
  it('should render approval details and file diff preview', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <ToolApprovalCard request={createRequest()} />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('Approval Needed');
    expect(output).toContain('edit_file');
    expect(output).toContain('Risk: write');
    expect(output).toContain('src/app.ts');
    expect(output).toContain('- const value = 1;');
    expect(output).toContain('+ const value = 2;');
    expect(output).toContain('a approve');
    expect(output).toContain('d deny');
    expect(output).toContain('no Enter');
  });
});

function createRequest(): ToolApprovalRequest {
  return {
    id: 'approval-1',
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
