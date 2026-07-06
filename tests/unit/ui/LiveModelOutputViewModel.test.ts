import { describe, expect, it } from 'vitest';
import { buildLiveModelOutputViewModel } from '../../../src/ui/workbench/LiveModelOutputViewModel';

describe('LiveModelOutputViewModel', () => {
  it('should sanitize markdown-heavy reasoning into a short preview', () => {
    const viewModel = buildLiveModelOutputViewModel({
      runId: 'run-1',
      stage: 'reasoning',
      reasoning:
        '# Plan\n\n- **Read** the sidebar file\n- `Edit` the route\n\n```tsx\nconst value = 1;\n```',
      text: '',
    });

    expect(viewModel).toMatchObject({
      title: 'Thinking',
      meta: expect.stringContaining('chars'),
    });
    expect(viewModel?.preview).toContain('Plan Read the sidebar file');
    expect(viewModel?.preview).not.toContain('#');
    expect(viewModel?.preview).not.toContain('**');
    expect(viewModel?.preview).not.toContain('```');
    expect(viewModel?.preview.length ?? 0).toBeLessThanOrEqual(140);
  });

  it('should show active tool names without raw content', () => {
    const viewModel = buildLiveModelOutputViewModel({
      runId: 'run-1',
      stage: 'tool',
      reasoning: 'Long reasoning that should not be shown for tool stage',
      text: '',
      toolName: 'edit_file',
    });

    expect(viewModel).toMatchObject({
      title: 'Running edit_file',
      preview: 'Tool is running',
    });
  });
});
