import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import type { ToolApprovalDecision } from './ToolApprovalPolicy';
import type { ToolSandboxDecision } from './ToolSandboxPolicy';
import { UnifiedPatchService, extractPatchPaths } from './patch/UnifiedPatchService';

export type ToolApprovalPreviewKind = 'file_diff' | 'none';

export interface ToolApprovalPreview {
  kind: ToolApprovalPreviewKind;
  relativePath?: string;
  beforeExists?: boolean;
  diff?: string;
  summary: string;
}

export interface ToolApprovalRequest {
  id: string;
  toolName: string;
  input: unknown;
  approval: ToolApprovalDecision;
  sandbox?: ToolSandboxDecision;
  preview: ToolApprovalPreview;
  terminalPreview: string;
  timestamp: number;
}

export interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  reason?: string;
}

/**
 * ToolApprovalRequestService builds the data a terminal UI needs before asking
 * the user to approve a tool call.
 */
export class ToolApprovalRequestService {
  private sequence = 0;
  private pendingResponses = new Map<string, (response: ToolApprovalResponse) => void>();

  async createRequest(
    toolName: string,
    input: unknown,
    approval: ToolApprovalDecision,
    cwd: string,
    sandbox?: ToolSandboxDecision
  ): Promise<ToolApprovalRequest> {
    const preview = await this.createPreview(toolName, input, cwd);
    const request: ToolApprovalRequest = {
      id: this.nextId(),
      toolName,
      input,
      approval,
      sandbox,
      preview,
      terminalPreview: '',
      timestamp: Date.now(),
    };

    return {
      ...request,
      terminalPreview: this.formatForTerminal(request),
    };
  }

  formatForTerminal(request: Omit<ToolApprovalRequest, 'terminalPreview'>): string {
    const lines = [
      'Tool approval required',
      `Tool: ${request.toolName}`,
      `Risk: ${request.approval.risk}`,
      `Reason: ${request.approval.reason}`,
      `Preview: ${request.preview.summary}`,
    ];

    if (request.preview.diff) {
      lines.push('', 'Diff preview:', request.preview.diff);
    }

    return lines.join('\n');
  }

  /**
   * Waits for the terminal UI to answer a specific approval request.
   *
   * ToolManager registers this promise before emitting `tool_approval_request`,
   * so a fast test or UI handler can approve synchronously without racing the
   * resolver setup.
   */
  waitForResponse(requestId: string): Promise<ToolApprovalResponse> {
    return new Promise((resolve) => {
      this.pendingResponses.set(requestId, resolve);
    });
  }

  /**
   * Resolves a pending approval request from an event bus response.
   *
   * Unknown request IDs are ignored. This keeps stale key presses or duplicate
   * UI events from crashing the tool execution path.
   */
  resolveResponse(response: ToolApprovalResponse): void {
    const resolve = this.pendingResponses.get(response.requestId);
    if (!resolve) {
      return;
    }

    this.pendingResponses.delete(response.requestId);
    resolve(response);
  }

  private async createPreview(
    toolName: string,
    input: unknown,
    cwd: string
  ): Promise<ToolApprovalPreview> {
    if (toolName === 'write_file') {
      return this.previewWriteFile(input, cwd);
    }

    if (toolName === 'edit_file') {
      return this.previewEditFile(input, cwd);
    }

    if (toolName === 'apply_patch') {
      return this.previewApplyPatch(input, cwd);
    }

    return {
      kind: 'none',
      summary: 'No preview available for this tool call.',
    };
  }

  private async previewWriteFile(input: unknown, cwd: string): Promise<ToolApprovalPreview> {
    const record = this.asRecord(input);
    const targetPath = this.asString(record.path);
    const content = this.asString(record.content);
    if (!targetPath || content === undefined) {
      return {
        kind: 'none',
        summary: 'write_file input does not contain a previewable path and content.',
      };
    }

    const absolutePath = path.resolve(cwd, targetPath);
    const before = await this.readTextFile(absolutePath);
    return this.createFileDiffPreview(cwd, absolutePath, before.exists, before.content, content);
  }

  private async previewEditFile(input: unknown, cwd: string): Promise<ToolApprovalPreview> {
    const record = this.asRecord(input);
    const targetPath = this.asString(record.path);
    const oldContent = this.asString(record.oldContent);
    const newContent = this.asString(record.newContent);
    const regex = record.regex === true;
    if (!targetPath || oldContent === undefined || newContent === undefined) {
      return {
        kind: 'none',
        summary: 'edit_file input does not contain a previewable path and replacement.',
      };
    }

    const absolutePath = path.resolve(cwd, targetPath);
    const before = await this.readTextFile(absolutePath);
    const afterContent = regex
      ? before.content.replace(new RegExp(oldContent, 'g'), newContent)
      : before.content.replace(oldContent, newContent);

    return this.createFileDiffPreview(
      cwd,
      absolutePath,
      before.exists,
      before.content,
      afterContent
    );
  }

  private async previewApplyPatch(input: unknown, cwd: string): Promise<ToolApprovalPreview> {
    const record = this.asRecord(input);
    const patch = this.asString(record.patch);
    if (!patch) {
      return {
        kind: 'none',
        summary: 'apply_patch input does not contain a previewable patch.',
      };
    }

    const paths = extractPatchPaths(patch);
    const preview = await new UnifiedPatchService(cwd).preview(patch);
    const fileCount = paths.length;
    return {
      kind: 'file_diff',
      relativePath: paths[0],
      beforeExists: preview.files[0]?.beforeExists,
      diff: patch,
      summary: `Patch preview for ${fileCount} ${fileCount === 1 ? 'file' : 'files'}: ${paths.join(', ')}`,
    };
  }

  private createFileDiffPreview(
    cwd: string,
    absolutePath: string,
    beforeExists: boolean,
    beforeContent: string,
    afterContent: string
  ): ToolApprovalPreview {
    const relativePath = path.relative(cwd, absolutePath);
    const diff = this.generateDiff(beforeContent, afterContent);
    return {
      kind: 'file_diff',
      relativePath,
      beforeExists,
      diff,
      summary: `File change preview for ${relativePath}`,
    };
  }

  private async readTextFile(filePath: string): Promise<{ exists: boolean; content: string }> {
    try {
      return {
        exists: true,
        content: await fs.readFile(filePath, 'utf-8'),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          exists: false,
          content: '',
        };
      }
      throw error;
    }
  }

  private generateDiff(beforeContent: string, afterContent: string): string {
    const beforeLines = beforeContent.split('\n');
    const afterLines = afterContent.split('\n');
    const maxLines = Math.max(beforeLines.length, afterLines.length);
    const diff: string[] = [];

    for (let index = 0; index < maxLines; index++) {
      const beforeLine = beforeLines[index];
      const afterLine = afterLines[index];

      if (beforeLine === afterLine) {
        continue;
      }

      if (beforeLine !== undefined) {
        diff.push(`- ${beforeLine}`);
      }

      if (afterLine !== undefined) {
        diff.push(`+ ${afterLine}`);
      }
    }

    return diff.join('\n');
  }

  private asRecord(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private nextId(): string {
    this.sequence += 1;
    return `approval-${Date.now()}-${this.sequence}`;
  }
}
