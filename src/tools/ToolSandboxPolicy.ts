import * as path from 'pathe';
import { extractPatchPaths } from './patch/UnifiedPatchService';

export type ToolSandboxStatus = 'allow' | 'deny' | 'requires_approval';
export type ToolSandboxCategory = 'file' | 'shell' | 'network' | 'interactive' | 'unknown';

export interface ToolSandboxDecision {
  status: ToolSandboxStatus;
  category: ToolSandboxCategory;
  reason: string;
}

/**
 * ToolSandboxPolicy 做工具调用的第一层边界判断。
 *
 * 调用链路：
 * ToolManager.execute / executeWithResult -> ToolSandboxPolicy.check -> ToolApprovalPolicy.decide
 *
 * 它不替代审批系统。沙箱策略负责“能不能碰这个边界”，审批策略负责“要不要用户批准”。
 * 本章先实现可解释的轻量策略，后续可以替换成真实进程沙箱、网络代理或容器隔离。
 */
export class ToolSandboxPolicy {
  /**
   * 根据工具名、输入和当前工作区判断沙箱决策。
   */
  check(toolName: string, input: unknown, cwd: string): ToolSandboxDecision {
    if (this.isFileTool(toolName)) {
      return this.checkFileTool(toolName, input, cwd);
    }

    if (toolName === 'bash' || toolName === 'exec') {
      return this.checkShellTool(toolName, input);
    }

    if (toolName === 'fetch' || toolName === 'web_search') {
      return this.checkNetworkTool(toolName, input);
    }

    if (['ask_user', 'confirm', 'task', 'skill', 'todo_write', 'todo_read'].includes(toolName)) {
      return {
        status: 'allow',
        category: 'interactive',
        reason: 'Interactive and planning tools stay inside the agent runtime.',
      };
    }

    return {
      status: 'requires_approval',
      category: 'unknown',
      reason: 'Unknown tool category requires explicit review.',
    };
  }

  private checkFileTool(toolName: string, input: unknown, cwd: string): ToolSandboxDecision {
    const targetPaths = this.extractPaths(toolName, input);
    if (targetPaths.length === 0) {
      return {
        status: 'requires_approval',
        category: 'file',
        reason: 'File tool input does not include a clear path or valid patch.',
      };
    }

    const resolvedCwd = path.resolve(cwd);
    for (const targetPath of targetPaths) {
      const resolvedPath = path.resolve(resolvedCwd, targetPath);
      if (!resolvedPath.startsWith(`${resolvedCwd}${path.sep}`) && resolvedPath !== resolvedCwd) {
        return {
          status: 'deny',
          category: 'file',
          reason: `File tool target is outside the workspace: ${targetPath}`,
        };
      }
    }

    if (this.isReadOnlyFileTool(toolName)) {
      return {
        status: 'allow',
        category: 'file',
        reason: 'Read-only file access stays inside the workspace.',
      };
    }

    return {
      status: 'requires_approval',
      category: 'file',
      reason: 'File mutation stays inside the workspace but still requires approval.',
    };
  }

  private checkShellTool(toolName: string, input: unknown): ToolSandboxDecision {
    const command = this.extractCommand(toolName, input);
    if (!command) {
      return {
        status: 'requires_approval',
        category: 'shell',
        reason: 'Shell tool input does not include a clear command.',
      };
    }

    const destructivePatterns = [
      /\brm\s+-rf\b/,
      /\bgit\s+reset\s+--hard\b/,
      /\bgit\s+clean\s+-fd\b/,
      /\bsudo\b/,
      /\bchmod\s+-R\b/,
      /\bchown\s+-R\b/,
      />\s*\/dev\/(?:disk|rdisk)/,
    ];
    if (destructivePatterns.some((pattern) => pattern.test(command))) {
      return {
        status: 'deny',
        category: 'shell',
        reason: 'Shell command matches a destructive pattern.',
      };
    }

    return {
      status: 'requires_approval',
      category: 'shell',
      reason: 'Shell commands can change machine state and require explicit approval.',
    };
  }

  private checkNetworkTool(toolName: string, input: unknown): ToolSandboxDecision {
    const url = this.extractUrl(toolName, input);
    if (!url) {
      return {
        status: 'requires_approval',
        category: 'network',
        reason: 'Network tool input does not include a clear target URL or query.',
      };
    }

    if (this.isBlockedNetworkTarget(url)) {
      return {
        status: 'deny',
        category: 'network',
        reason: 'Network access to local, private, or metadata addresses is blocked.',
      };
    }

    return {
      status: 'requires_approval',
      category: 'network',
      reason: 'External network access requires explicit approval.',
    };
  }

  private isFileTool(toolName: string): boolean {
    return [
      'read_file',
      'list_files',
      'write_file',
      'edit_file',
      'edit_code',
      'apply_patch',
      'delete_file',
      'grep',
      'glob',
    ].includes(toolName);
  }

  private isReadOnlyFileTool(toolName: string): boolean {
    return ['read_file', 'list_files', 'grep', 'glob'].includes(toolName);
  }

  private extractPath(input: unknown): string {
    if (!input || typeof input !== 'object') {
      return '';
    }

    const data = input as Record<string, unknown>;
    for (const key of ['path', 'directory', 'cwd', 'pattern']) {
      if (typeof data[key] === 'string') {
        return data[key];
      }
    }

    return '';
  }

  private extractPaths(toolName: string, input: unknown): string[] {
    if (toolName !== 'apply_patch') {
      const targetPath = this.extractPath(input);
      return targetPath ? [targetPath] : [];
    }

    if (!input || typeof input !== 'object') {
      return [];
    }
    const patch = (input as Record<string, unknown>).patch;
    if (typeof patch !== 'string') {
      return [];
    }

    try {
      return extractPatchPaths(patch);
    } catch {
      return [];
    }
  }

  private extractCommand(toolName: string, input: unknown): string {
    if (!input || typeof input !== 'object') {
      return '';
    }

    const data = input as Record<string, unknown>;
    if (toolName === 'bash' && typeof data.command === 'string') {
      return data.command;
    }
    if (toolName === 'exec') {
      const scriptPath = typeof data.scriptPath === 'string' ? data.scriptPath : '';
      const args = Array.isArray(data.args) ? data.args.join(' ') : '';
      return `${scriptPath} ${args}`.trim();
    }

    return '';
  }

  private extractUrl(toolName: string, input: unknown): string {
    if (!input || typeof input !== 'object') {
      return '';
    }

    const data = input as Record<string, unknown>;
    if (toolName === 'fetch' && typeof data.url === 'string') {
      return data.url;
    }
    if (toolName === 'web_search' && typeof data.query === 'string') {
      return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(data.query)}`;
    }

    return '';
  }

  private isBlockedNetworkTarget(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      const host = parsed.hostname.toLowerCase();

      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host === '169.254.169.254' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      );
    } catch {
      return false;
    }
  }
}
