import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'pathe';

export interface VerificationCommand {
  name: string;
  command: string;
}

export interface VerificationCommandResult extends VerificationCommand {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface VerificationResult {
  success: boolean;
  commands: VerificationCommandResult[];
  summary: string;
}

export interface VerificationOptions {
  timeoutMs?: number;
  maxCommands?: number;
  maxOutputChars?: number;
}

export type VerificationRunner = (
  command: string,
  cwd: string,
  timeoutMs: number
) => Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}>;

/**
 * VerificationService discovers project validation commands and runs a small,
 * bounded verification pass after an agent changes files.
 */
export class VerificationService {
  constructor(
    private cwd: string,
    private options: VerificationOptions = {},
    private runner: VerificationRunner = defaultRunner
  ) {}

  async discoverCommands(): Promise<VerificationCommand[]> {
    const packageJson = await this.readPackageJson();
    if (!packageJson?.scripts || typeof packageJson.scripts !== 'object') {
      return [];
    }

    const scripts = packageJson.scripts as Record<string, unknown>;
    const packageManager = await this.detectPackageManager();
    const priority = ['typecheck', 'test', 'build', 'lint'];

    return priority
      .filter((scriptName) => typeof scripts[scriptName] === 'string')
      .map((scriptName) => ({
        name: scriptName,
        command: this.formatRunCommand(packageManager, scriptName),
      }));
  }

  async verify(): Promise<VerificationResult> {
    const commands = (await this.discoverCommands()).slice(0, this.options.maxCommands ?? 2);

    if (commands.length === 0) {
      return {
        success: true,
        commands: [],
        summary: 'No verification scripts were found.',
      };
    }

    const results: VerificationCommandResult[] = [];

    for (const command of commands) {
      const startedAt = Date.now();
      const output = await this.runner(command.command, this.cwd, this.options.timeoutMs ?? 30000);
      const result: VerificationCommandResult = {
        ...command,
        success: output.exitCode === 0,
        exitCode: output.exitCode,
        stdout: this.truncate(output.stdout),
        stderr: this.truncate(output.stderr),
        durationMs: Date.now() - startedAt,
      };

      results.push(result);

      if (!result.success) {
        break;
      }
    }

    const success = results.every((result) => result.success);

    return {
      success,
      commands: results,
      summary: this.formatSummary(results, success),
    };
  }

  private async readPackageJson(): Promise<Record<string, unknown> | undefined> {
    try {
      const content = await fs.readFile(path.join(this.cwd, 'package.json'), 'utf-8');
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private async detectPackageManager(): Promise<'pnpm' | 'yarn' | 'npm'> {
    if (await this.exists('pnpm-lock.yaml')) return 'pnpm';
    if (await this.exists('yarn.lock')) return 'yarn';
    return 'npm';
  }

  private async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.cwd, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  private formatRunCommand(packageManager: 'pnpm' | 'yarn' | 'npm', scriptName: string): string {
    if (packageManager === 'yarn') {
      return `yarn ${scriptName}`;
    }

    return `${packageManager} run ${scriptName}`;
  }

  private truncate(output: string): string {
    const max = this.options.maxOutputChars ?? 4000;
    if (output.length <= max) {
      return output;
    }

    return `${output.slice(0, max)}\n...[truncated]`;
  }

  private formatSummary(results: VerificationCommandResult[], success: boolean): string {
    const status = success ? 'passed' : 'failed';
    const lines = [`Verification ${status}:`];

    for (const result of results) {
      const marker = result.success ? 'PASS' : 'FAIL';
      lines.push(`- ${marker} ${result.command} (${result.durationMs}ms)`);

      if (!result.success) {
        const output = result.stderr || result.stdout;
        if (output.trim()) {
          lines.push('');
          lines.push('Failure output:');
          lines.push(output.trim());
        }
      }
    }

    return lines.join('\n');
  }
}

const defaultRunner: VerificationRunner = (command, cwd, timeoutMs) =>
  new Promise((resolve) => {
    exec(command, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
      const errorCode = (error as NodeJS.ErrnoException | null)?.code;
      const exitCode = typeof errorCode === 'number' ? errorCode : error ? 1 : 0;

      resolve({
        exitCode,
        stdout,
        stderr,
      });
    });
  });
