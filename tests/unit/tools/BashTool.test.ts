import * as path from 'pathe';
import { describe, expect, it, vi } from 'vitest';
import type { ProcessSandboxService } from '../../../src/tools/process/ProcessSandboxService';
import { BashTool } from '../../../src/tools/system/BashTool';

const workspaceRoot = path.resolve('/workspace/project');

describe('BashTool', () => {
  it('should delegate command execution to the process sandbox', async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: 'tests passed',
      stderr: '',
      exitCode: 0,
      sandbox: {
        mode: 'strict',
        backend: 'sandbox-exec',
        enforced: true,
        network: 'deny',
      },
    });
    const tool = new BashTool({ execute } as unknown as ProcessSandboxService, workspaceRoot);

    const result = await tool.execute({ command: 'pnpm test' });

    expect(execute).toHaveBeenCalledWith({
      command: 'pnpm test',
      workspaceRoot,
      cwd: workspaceRoot,
      shell: expect.any(String),
    });
    expect(result).toMatchObject({
      success: true,
      stdout: 'tests passed',
      sandbox: { enforced: true, backend: 'sandbox-exec' },
    });
  });

  it('should reject a non-zero sandboxed command result', async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'command not found',
      exitCode: 127,
      sandbox: {
        mode: 'strict',
        backend: 'sandbox-exec',
        enforced: true,
        network: 'deny',
      },
    });
    const tool = new BashTool({ execute } as unknown as ProcessSandboxService, workspaceRoot);

    await expect(tool.execute({ command: 'missing-command' })).rejects.toThrow('command not found');
  });
});
