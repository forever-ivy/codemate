import * as path from 'pathe';
import { z } from 'zod';
import { getShell } from '../../utils/commandHelper';
import { Tool } from '../base/Tool';
import {
  ProcessSandboxService,
  type ProcessSandboxMetadata,
} from '../process/ProcessSandboxService';

export interface ExecToolResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  sandbox: ProcessSandboxMetadata;
}

/**
 * ExecTool 把工作区脚本转换为安全引用的 shell 命令，再交给统一 OS 沙箱执行。
 */
export class ExecTool extends Tool {
  name = 'exec';
  description = 'Execute a workspace script inside the configured OS sandbox';

  schema = z.object({
    scriptPath: z.string().describe('Path to a script inside the workspace'),
    args: z.array(z.string()).optional().describe('Script arguments'),
    cwd: z.string().optional().describe('Working directory inside the workspace'),
  });

  constructor(
    private readonly processSandbox = createDefaultProcessSandbox(),
    private readonly workspaceRoot = process.cwd()
  ) {
    super();
  }

  async execute(input: z.infer<typeof this.schema>): Promise<ExecToolResult> {
    const scriptPath = path.resolve(this.workspaceRoot, input.scriptPath);
    this.assertInsideWorkspace(scriptPath);

    const command = [scriptPath, ...(input.args ?? [])].map(quoteShellArgument).join(' ');
    const result = await this.processSandbox.execute({
      command,
      workspaceRoot: this.workspaceRoot,
      cwd: input.cwd ? path.resolve(this.workspaceRoot, input.cwd) : this.workspaceRoot,
      shell: getShell(),
    });

    return {
      success: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      sandbox: result.sandbox,
    };
  }

  private assertInsideWorkspace(targetPath: string): void {
    const root = path.resolve(this.workspaceRoot);
    if (targetPath !== root && !targetPath.startsWith(`${root}${path.sep}`)) {
      throw new Error(`Script path is outside the workspace: ${targetPath}`);
    }
  }
}

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function createDefaultProcessSandbox(): ProcessSandboxService {
  return new ProcessSandboxService({
    mode: 'permissive',
    network: 'deny',
    allowUnsandboxedFallback: true,
  });
}
