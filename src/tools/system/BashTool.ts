import * as os from 'node:os';
import * as path from 'pathe';
import { z } from 'zod';
import { adaptCommand, getShell } from '../../utils/commandHelper';
import { Tool } from '../base/Tool';
import {
  ProcessSandboxService,
  type ProcessSandboxMetadata,
} from '../process/ProcessSandboxService';

export interface BashToolResult {
  success: true;
  stdout: string;
  stderr: string;
  exitCode: number;
  platform: NodeJS.Platform;
  sandbox: ProcessSandboxMetadata;
}

/**
 * BashTool 只负责命令输入契约；真实进程必须由 ProcessSandboxService 启动。
 */
export class BashTool extends Tool {
  name = 'bash';
  description = 'Execute shell commands inside the configured OS sandbox';

  schema = z.object({
    command: z.string().describe('Shell command to execute'),
    cwd: z.string().optional().describe('Working directory inside the workspace'),
  });

  constructor(
    private readonly processSandbox = createDefaultProcessSandbox(),
    private readonly workspaceRoot = process.cwd()
  ) {
    super();
  }

  async execute(input: z.infer<typeof this.schema>): Promise<BashToolResult> {
    const result = await this.processSandbox.execute({
      command: adaptCommand(input.command),
      workspaceRoot: this.workspaceRoot,
      cwd: input.cwd ? path.resolve(this.workspaceRoot, input.cwd) : this.workspaceRoot,
      shell: getShell(),
    });

    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
      );
    }

    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      platform: os.platform(),
      sandbox: result.sandbox,
    };
  }
}

function createDefaultProcessSandbox(): ProcessSandboxService {
  return new ProcessSandboxService({
    mode: 'permissive',
    network: 'deny',
    allowUnsandboxedFallback: true,
  });
}
