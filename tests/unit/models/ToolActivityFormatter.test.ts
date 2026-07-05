import { describe, expect, it } from 'vitest';
import { formatToolActivityTitle } from '../../../src/models/ToolActivityFormatter';

describe('ToolActivityFormatter', () => {
  it('should format file tool calls with their target path', () => {
    expect(formatToolActivityTitle('read_file', { path: 'package.json' })).toBe(
      'read(package.json)'
    );
    expect(formatToolActivityTitle('write_file', { path: 'src/App.tsx' })).toBe(
      'write(src/App.tsx)'
    );
    expect(formatToolActivityTitle('edit_file', { path: 'src/layout/AppSidebar.tsx' })).toBe(
      'edit(src/layout/AppSidebar.tsx)'
    );
    expect(formatToolActivityTitle('edit_code', { path: 'src/main.tsx' })).toBe(
      'edit_code(src/main.tsx)'
    );
  });

  it('should format apply_patch without printing the full patch payload', () => {
    expect(
      formatToolActivityTitle('apply_patch', {
        patch: '--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-old\n+new\n',
      })
    ).toBe('patch(workspace files)');
  });

  it('should format search, listing and shell calls compactly', () => {
    expect(formatToolActivityTitle('list_files', { path: 'src' })).toBe('list(src)');
    expect(formatToolActivityTitle('grep', { pattern: 'UserIcon', path: 'src' })).toBe(
      'grep("UserIcon" in src)'
    );
    expect(formatToolActivityTitle('bash', { command: 'pnpm run typecheck' })).toBe(
      'bash(pnpm run typecheck)'
    );
  });

  it('should keep unknown or missing input readable', () => {
    expect(formatToolActivityTitle('custom_tool')).toBe('custom_tool(...)');
    expect(formatToolActivityTitle('read_file', {})).toBe('read(file)');
  });

  it('should truncate very long shell commands', () => {
    const title = formatToolActivityTitle('bash', {
      command: 'node scripts/generate-report.js --with-a-very-long-option-name --another-long-flag',
    });

    expect(title).toMatch(/^bash\(node scripts\/generate-report\.js/);
    expect(title.length).toBeLessThanOrEqual(72);
    expect(title).toContain('...');
  });
});
