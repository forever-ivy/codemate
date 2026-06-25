import type { ApprovalMode } from '../types/index';

export type ToolRiskLevel = 'read' | 'write' | 'execute' | 'network' | 'interactive' | 'dangerous';

export type ToolApprovalStatus = 'allow' | 'deny' | 'requires_approval';

export interface ToolApprovalDecision {
  status: ToolApprovalStatus;
  risk: ToolRiskLevel;
  reason: string;
}

/**
 * ToolApprovalPolicy decides whether a tool call is safe to run automatically.
 *
 * It is deliberately separate from ToolManager so the rules are easy to test
 * and can later be replaced by a richer interactive approval UI.
 */
export class ToolApprovalPolicy {
  constructor(private mode: ApprovalMode = 'default') {}

  setMode(mode: ApprovalMode): void {
    this.mode = mode;
  }

  getMode(): ApprovalMode {
    return this.mode;
  }

  decide(toolName: string, input: unknown): ToolApprovalDecision {
    const risk = this.classify(toolName, input);

    if (this.mode === 'yolo') {
      return {
        status: 'allow',
        risk,
        reason: 'YOLO mode allows every registered tool call.',
      };
    }

    if (risk === 'read') {
      return {
        status: 'allow',
        risk,
        reason: 'Read-only tools are safe to run automatically.',
      };
    }

    if (this.mode === 'autoEdit' && risk === 'write') {
      return {
        status: 'allow',
        risk,
        reason: 'autoEdit mode allows file-editing tools.',
      };
    }

    if (
      this.mode === 'autoEdit' &&
      risk === 'execute' &&
      this.isSafeVerificationCommand(toolName, input)
    ) {
      return {
        status: 'allow',
        risk,
        reason: 'autoEdit mode allows safe project verification commands.',
      };
    }

    if (risk === 'dangerous') {
      return {
        status: 'deny',
        risk,
        reason: 'Dangerous tool calls are blocked unless YOLO mode is enabled.',
      };
    }

    return {
      status: 'requires_approval',
      risk,
      reason: `${toolName} requires user approval in ${this.mode} mode.`,
    };
  }

  private classify(toolName: string, input: unknown): ToolRiskLevel {
    if (this.isDangerousShellCall(toolName, input)) {
      return 'dangerous';
    }

    const readTools = new Set(['read_file', 'list_files', 'grep', 'glob', 'todo_read']);
    if (readTools.has(toolName)) {
      return 'read';
    }

    const writeTools = new Set([
      'write_file',
      'edit_file',
      'edit_code',
      'apply_patch',
      'delete_file',
      'todo_write',
      'exit_plan',
    ]);
    if (writeTools.has(toolName)) {
      return toolName === 'delete_file' ? 'dangerous' : 'write';
    }

    const executeTools = new Set(['bash', 'exec']);
    if (executeTools.has(toolName)) {
      return 'execute';
    }

    const networkTools = new Set(['fetch', 'web_search']);
    if (networkTools.has(toolName)) {
      return 'network';
    }

    const interactiveTools = new Set(['ask_user', 'confirm', 'task', 'skill']);
    if (interactiveTools.has(toolName)) {
      return 'interactive';
    }

    return 'requiresApproval' in Object(input || {}) ? 'interactive' : 'write';
  }

  private isDangerousShellCall(toolName: string, input: unknown): boolean {
    if (toolName !== 'bash' && toolName !== 'exec') {
      return false;
    }

    const command = this.extractCommand(toolName, input);
    if (!command) {
      return false;
    }

    const dangerousPatterns = [
      /\brm\s+-rf\b/,
      /\bgit\s+reset\s+--hard\b/,
      /\bgit\s+clean\s+-fd\b/,
      /\bsudo\b/,
      /\bchmod\s+-R\b/,
      /\bchown\s+-R\b/,
      /\b(?:curl|wget)\b.*\|\s*(?:sh|bash)\b/,
      />\s*\/dev\/(?:disk|rdisk)/,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }

  private isSafeVerificationCommand(toolName: string, input: unknown): boolean {
    if (toolName !== 'bash') {
      return false;
    }

    const command = this.normalizeCommand(this.extractCommand(toolName, input));
    if (!command || this.hasShellControlOperator(command)) {
      return false;
    }

    const commandWithoutCd = this.stripLeadingCd(command);
    const safePatterns = [
      /^pnpm run (?:build|lint|typecheck|test)(?:\s+--[\w:-]+)*$/,
      /^pnpm exec vitest run(?:\s+[\w./@:-]+)*$/,
      /^npm run (?:build|lint|typecheck|test)(?:\s+--[\w:-]+)*$/,
      /^npm test(?:\s+--[\w:-]+)*$/,
      /^npx tsc --noEmit$/,
    ];

    return safePatterns.some((pattern) => pattern.test(commandWithoutCd));
  }

  private normalizeCommand(command: string): string {
    return command.trim().replace(/\s+/g, ' ');
  }

  private hasShellControlOperator(command: string): boolean {
    const withoutLeadingCd = command.replace(/^cd\s+[^;&|`$]+&&\s*/, '');
    return /[;|`$]/.test(withoutLeadingCd) || /\|\|/.test(withoutLeadingCd);
  }

  private stripLeadingCd(command: string): string {
    return command.replace(/^cd\s+[^;&|`$]+&&\s*/, '').trim();
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
}
