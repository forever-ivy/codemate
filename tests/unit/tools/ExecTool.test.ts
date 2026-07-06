import * as path from 'pathe';
import { describe, expect, it, vi } from 'vitest';
import type { ProcessSandboxService } from '../../../src/tools/process/ProcessSandboxService';
import { ExecTool } from '../../../src/tools/system/ExecTool';

const workspaceRoot = path.resolve('/workspace/project');

describe('ExecTool', () => {
  it('should quote the workspace script and arguments before sandbox delegation', async () => {
    const execute = vi.fn().mockResolvedValue({
      stdout: 'done',
      stderr: '',
      exitCode: 0,
      sandbox: {
        mode: 'strict',
        backend: 'bwrap',
        enforced: true,
        network: 'deny',
      },
    });
    const tool = new ExecTool({ execute } as unknown as ProcessSandboxService, workspaceRoot);

    const result = await tool.execute({
      scriptPath: 'scripts/check.sh',
      args: ['hello world', "it's-safe"],
    });

    expect(execute).toHaveBeenCalledWith({
      command: expect.stringContaining("'hello world'"),
      workspaceRoot,
      cwd: workspaceRoot,
      shell: expect.any(String),
    });
    expect(execute.mock.calls[0][0].command).toContain("'it'\"'\"'s-safe'");
    expect(result).toMatchObject({
      success: true,
      stdout: 'done',
      exitCode: 0,
      sandbox: { enforced: true, backend: 'bwrap' },
    });
  });

  it('should reject script paths outside the workspace before execution', async () => {
    const execute = vi.fn();
    const tool = new ExecTool({ execute } as unknown as ProcessSandboxService, workspaceRoot);

    await expect(tool.execute({ scriptPath: '../outside.sh' })).rejects.toThrow(
      'outside the workspace'
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
