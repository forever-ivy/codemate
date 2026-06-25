import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'pathe';
import type { SandboxConfig } from '../../types/index';

export type ProcessSandboxBackend = 'sandbox-exec' | 'bwrap' | 'none';

export interface ProcessSandboxMetadata {
  mode: SandboxConfig['mode'];
  backend: ProcessSandboxBackend;
  enforced: boolean;
  network: SandboxConfig['network'];
  degradedReason?: string;
}

export interface ProcessSandboxRequest {
  command: string;
  workspaceRoot: string;
  cwd?: string;
  shell?: string;
}

export interface ProcessRunOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface ProcessRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessSandboxResult extends ProcessRunResult {
  sandbox: ProcessSandboxMetadata;
}

export interface ProcessSandboxDependencies {
  platform: NodeJS.Platform;
  findExecutable(name: string): Promise<string | undefined>;
  run(file: string, args: string[], options: ProcessRunOptions): Promise<ProcessRunResult>;
  environment: NodeJS.ProcessEnv;
  temporaryDirectory: string;
}

export class SandboxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxUnavailableError';
  }
}

/**
 * ProcessSandboxService 把 shell 策略落实为真实的子进程启动边界。
 *
 * 策略层决定某个工具调用是否允许进入执行阶段；本服务只负责选择 OS 后端、构造隔离参数，
 * 并在严格模式下保证无法建立隔离时拒绝启动进程。
 */
export class ProcessSandboxService {
  private readonly dependencies: ProcessSandboxDependencies;

  constructor(
    private readonly config: SandboxConfig,
    dependencies: Partial<ProcessSandboxDependencies> = {}
  ) {
    this.dependencies = {
      platform: process.platform,
      findExecutable: defaultFindExecutable,
      run: defaultRun,
      environment: process.env,
      temporaryDirectory: os.tmpdir(),
      ...dependencies,
    };
  }

  async execute(request: ProcessSandboxRequest): Promise<ProcessSandboxResult> {
    const workspaceRoot = path.resolve(request.workspaceRoot);
    const cwd = path.resolve(workspaceRoot, request.cwd ?? workspaceRoot);
    this.assertInsideWorkspace(cwd, workspaceRoot);

    const shell = request.shell ?? defaultShell(this.dependencies.platform);
    const options: ProcessRunOptions = {
      cwd,
      env: this.createReducedEnvironment(),
    };

    if (this.config.mode === 'disabled') {
      return this.runWithoutSandbox(request.command, shell, options, {
        mode: 'disabled',
        backend: 'none',
        enforced: false,
        network: this.config.network,
        degradedReason: 'OS sandbox enforcement is explicitly disabled.',
      });
    }

    const backend = await this.selectBackend();
    if (backend.backend === 'sandbox-exec') {
      const result = await this.dependencies.run(
        backend.executable,
        ['-p', this.createMacOSProfile(workspaceRoot), shell, '-c', request.command],
        options
      );
      return { ...result, sandbox: this.enforcedMetadata('sandbox-exec') };
    }

    if (backend.backend === 'bwrap') {
      const result = await this.dependencies.run(
        backend.executable,
        this.createBubblewrapArguments(request.command, shell, workspaceRoot, cwd),
        options
      );
      return { ...result, sandbox: this.enforcedMetadata('bwrap') };
    }

    const unavailableReason = `OS sandbox backend is unavailable for platform ${this.dependencies.platform}.`;
    if (this.config.mode === 'strict') {
      throw new SandboxUnavailableError(`OS sandbox backend is unavailable: ${unavailableReason}`);
    }
    if (!this.config.allowUnsandboxedFallback) {
      throw new SandboxUnavailableError(`Unsandboxed fallback is disabled: ${unavailableReason}`);
    }

    return this.runWithoutSandbox(request.command, shell, options, {
      mode: 'permissive',
      backend: 'none',
      enforced: false,
      network: this.config.network,
      degradedReason: unavailableReason,
    });
  }

  private async selectBackend(): Promise<
    { backend: 'sandbox-exec' | 'bwrap'; executable: string } | { backend: 'none' }
  > {
    if (this.dependencies.platform === 'darwin') {
      const executable = await this.dependencies.findExecutable('sandbox-exec');
      return executable ? { backend: 'sandbox-exec', executable } : { backend: 'none' };
    }
    if (this.dependencies.platform === 'linux') {
      const executable = await this.dependencies.findExecutable('bwrap');
      return executable ? { backend: 'bwrap', executable } : { backend: 'none' };
    }
    return { backend: 'none' };
  }

  private createMacOSProfile(workspaceRoot: string): string {
    const workspace = escapeSandboxLiteral(workspaceRoot);
    const temporaryDirectory = escapeSandboxLiteral(
      path.resolve(this.dependencies.temporaryDirectory)
    );
    const networkRule = this.config.network === 'allow' ? '(allow network*)' : '(deny network*)';

    return [
      '(version 1)',
      '(deny default)',
      '(allow process*)',
      '(allow file-read*)',
      `(allow file-write* (subpath "${workspace}") (subpath "${temporaryDirectory}"))`,
      '(allow file-read* file-write* (literal "/dev/null"))',
      '(allow sysctl-read)',
      '(allow mach-lookup)',
      networkRule,
    ].join('\n');
  }

  private createBubblewrapArguments(
    command: string,
    shell: string,
    workspaceRoot: string,
    cwd: string
  ): string[] {
    const temporaryDirectory = path.resolve(this.dependencies.temporaryDirectory);
    const args = [
      '--die-with-parent',
      '--new-session',
      '--ro-bind',
      '/',
      '/',
      '--bind',
      workspaceRoot,
      workspaceRoot,
      '--bind',
      temporaryDirectory,
      temporaryDirectory,
      '--chdir',
      cwd,
    ];
    if (this.config.network === 'deny') {
      args.push('--unshare-net');
    }
    args.push(shell, '-c', command);
    return args;
  }

  private createReducedEnvironment(): NodeJS.ProcessEnv {
    const allowedExact = new Set([
      'PATH',
      'HOME',
      'USER',
      'LOGNAME',
      'SHELL',
      'TERM',
      'LANG',
      'LC_ALL',
      'TMPDIR',
      'TEMP',
      'TMP',
      'CI',
      'NODE_ENV',
      'NO_COLOR',
      'FORCE_COLOR',
      'PNPM_HOME',
      'COREPACK_HOME',
    ]);
    const environment: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(this.dependencies.environment)) {
      if (allowedExact.has(key) || key.startsWith('npm_config_')) {
        environment[key] = value;
      }
    }
    return environment;
  }

  private assertInsideWorkspace(cwd: string, workspaceRoot: string): void {
    if (cwd !== workspaceRoot && !cwd.startsWith(`${workspaceRoot}${path.sep}`)) {
      throw new Error(`Process working directory is outside the workspace: ${cwd}`);
    }
  }

  private enforcedMetadata(backend: 'sandbox-exec' | 'bwrap'): ProcessSandboxMetadata {
    return {
      mode: this.config.mode,
      backend,
      enforced: true,
      network: this.config.network,
    };
  }

  private async runWithoutSandbox(
    command: string,
    shell: string,
    options: ProcessRunOptions,
    sandbox: ProcessSandboxMetadata
  ): Promise<ProcessSandboxResult> {
    const result = await this.dependencies.run(
      shell,
      shellArguments(this.dependencies.platform, shell, command),
      options
    );
    return { ...result, sandbox };
  }
}

async function defaultFindExecutable(name: string): Promise<string | undefined> {
  const result = await defaultRun('/usr/bin/env', ['which', name], {
    cwd: process.cwd(),
    env: process.env,
  });
  return result.exitCode === 0 && result.stdout.trim() ? result.stdout.trim() : undefined;
}

function defaultRun(
  file: string,
  args: string[],
  options: ProcessRunOptions
): Promise<ProcessRunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { cwd: options.cwd, env: options.env, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const exitCode = typeof error?.code === 'number' ? error.code : error ? 1 : 0;
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode });
      }
    );
  });
}

function defaultShell(platform: NodeJS.Platform): string {
  return platform === 'win32'
    ? (process.env.ComSpec ?? 'cmd.exe')
    : (process.env.SHELL ?? '/bin/sh');
}

function shellArguments(platform: NodeJS.Platform, shell: string, command: string): string[] {
  const shellName = path.basename(shell).toLowerCase();
  if (platform !== 'win32' || /^(?:ba|z|k|fi)?sh(?:\.exe)?$/.test(shellName)) {
    return ['-c', command];
  }
  return shellName.includes('powershell')
    ? ['-NoProfile', '-NonInteractive', '-Command', command]
    : ['/d', '/s', '/c', command];
}

function escapeSandboxLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
