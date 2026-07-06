import * as path from 'pathe';
import { describe, expect, it, vi } from 'vitest';
import {
  ProcessSandboxService,
  type ProcessSandboxDependencies,
} from '../../../src/tools/process/ProcessSandboxService';
import type { SandboxConfig } from '../../../src/types/index';

const workspaceRoot = path.resolve('/workspace/project');
const request = {
  command: 'pnpm test',
  workspaceRoot,
  cwd: workspaceRoot,
  shell: '/bin/zsh',
};

describe('ProcessSandboxService', () => {
  it('should enforce macOS commands with sandbox-exec when available', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const service = createService(
      { platform: 'darwin', findExecutable: async () => '/usr/bin/sandbox-exec', run },
      strictConfig()
    );

    const result = await service.execute(request);

    expect(result.sandbox).toEqual({
      mode: 'strict',
      backend: 'sandbox-exec',
      enforced: true,
      network: 'deny',
    });
    expect(run).toHaveBeenCalledWith(
      '/usr/bin/sandbox-exec',
      expect.arrayContaining([
        '-p',
        expect.stringContaining('(literal "/dev/null")'),
        '/bin/zsh',
        '-c',
      ]),
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('should enforce Linux commands with bwrap and a private network namespace', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const service = createService(
      { platform: 'linux', findExecutable: async () => '/usr/bin/bwrap', run },
      strictConfig()
    );

    const result = await service.execute(request);

    expect(result.sandbox.backend).toBe('bwrap');
    expect(run).toHaveBeenCalledWith(
      '/usr/bin/bwrap',
      expect.arrayContaining([
        '--ro-bind',
        '/',
        '/',
        '--bind',
        workspaceRoot,
        workspaceRoot,
        '--unshare-net',
        '/bin/zsh',
        '-c',
        'pnpm test',
      ]),
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('should fail closed in strict mode when no backend is available', async () => {
    const service = createService(
      { platform: 'darwin', findExecutable: async () => undefined },
      strictConfig()
    );

    await expect(service.execute(request)).rejects.toThrow('OS sandbox backend is unavailable');
  });

  it('should report degraded execution for an allowed permissive fallback', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const service = createService({ platform: 'win32', run });

    const result = await service.execute(request);

    expect(result.sandbox).toEqual({
      mode: 'permissive',
      backend: 'none',
      enforced: false,
      network: 'deny',
      degradedReason: 'OS sandbox backend is unavailable for platform win32.',
    });
    expect(run).toHaveBeenCalledWith(
      '/bin/zsh',
      ['-c', 'pnpm test'],
      expect.objectContaining({ cwd: workspaceRoot })
    );
  });

  it('should reject permissive fallback when it is disabled by policy', async () => {
    const service = createService(
      { platform: 'win32' },
      {
        mode: 'permissive',
        network: 'deny',
        allowUnsandboxedFallback: false,
      }
    );

    await expect(service.execute(request)).rejects.toThrow('Unsandboxed fallback is disabled');
  });

  it('should reject working directories outside the workspace before launch', async () => {
    const run = vi.fn();
    const service = createService({ run });

    await expect(
      service.execute({ ...request, cwd: path.resolve(workspaceRoot, '..', 'outside') })
    ).rejects.toThrow('outside the workspace');
    expect(run).not.toHaveBeenCalled();
  });

  it('should pass a reduced environment without common secret variables', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const service = createService({ platform: 'win32', run });

    await service.execute(request);

    const options = run.mock.calls[0][2];
    expect(options.env).toMatchObject({ PATH: '/usr/bin', LANG: 'en_US.UTF-8' });
    expect(options.env.API_KEY).toBeUndefined();
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
  });

  it('should make disabled mode explicit in result metadata', async () => {
    const run = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const service = createService(
      { run },
      { mode: 'disabled', network: 'allow', allowUnsandboxedFallback: true }
    );

    const result = await service.execute(request);

    expect(result.sandbox).toEqual({
      mode: 'disabled',
      backend: 'none',
      enforced: false,
      network: 'allow',
      degradedReason: 'OS sandbox enforcement is explicitly disabled.',
    });
  });
});

function createService(
  overrides: Partial<ProcessSandboxDependencies> = {},
  config: SandboxConfig = {
    mode: 'permissive',
    network: 'deny',
    allowUnsandboxedFallback: true,
  }
): ProcessSandboxService {
  return new ProcessSandboxService(config, {
    platform: 'darwin',
    findExecutable: async () => undefined,
    run: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    environment: {
      PATH: '/usr/bin',
      LANG: 'en_US.UTF-8',
      API_KEY: 'secret',
      GITHUB_TOKEN: 'secret-token',
    },
    temporaryDirectory: '/tmp',
    ...overrides,
  });
}

function strictConfig(): SandboxConfig {
  return {
    mode: 'strict',
    network: 'deny',
    allowUnsandboxedFallback: false,
  };
}
