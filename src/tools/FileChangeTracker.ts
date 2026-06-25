import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { extractPatchPaths } from './patch/UnifiedPatchService';

export type FileChangeKind = 'created' | 'modified' | 'deleted' | 'unchanged';

export interface FileChangeSnapshot {
  toolName: string;
  path: string;
  relativePath: string;
  beforeExists: boolean;
  beforeContent: string;
}

export interface FileChangeRecord {
  toolName: string;
  path: string;
  relativePath: string;
  kind: FileChangeKind;
  beforeContent: string;
  afterContent: string;
  diff: string;
}

/**
 * FileChangeTracker captures before/after content for file-mutating tools.
 */
export class FileChangeTracker {
  private mutationTools = new Set([
    'write_file',
    'edit_file',
    'edit_code',
    'apply_patch',
    'delete_file',
  ]);

  async captureBeforeMany(
    toolName: string,
    input: unknown,
    cwd: string
  ): Promise<FileChangeSnapshot[]> {
    if (!this.mutationTools.has(toolName)) {
      return [];
    }

    const targetPaths =
      toolName === 'apply_patch' ? this.extractPatchPaths(input) : [this.extractPath(input)];
    const snapshots: FileChangeSnapshot[] = [];
    for (const targetPath of targetPaths) {
      if (!targetPath) continue;
      const snapshot = await this.capturePath(toolName, targetPath, cwd);
      snapshots.push(snapshot);
    }
    return snapshots;
  }

  async captureBefore(
    toolName: string,
    input: unknown,
    cwd: string
  ): Promise<FileChangeSnapshot | undefined> {
    const targetPath = this.extractPath(input);
    if (!this.mutationTools.has(toolName) || !targetPath) {
      return undefined;
    }

    return this.capturePath(toolName, targetPath, cwd);
  }

  private async capturePath(
    toolName: string,
    targetPath: string,
    cwd: string
  ): Promise<FileChangeSnapshot> {
    const absolutePath = path.resolve(cwd, targetPath);
    const before = await this.readTextFile(absolutePath);

    return {
      toolName,
      path: absolutePath,
      relativePath: path.relative(cwd, absolutePath),
      beforeExists: before.exists,
      beforeContent: before.content,
    };
  }

  private extractPatchPaths(input: unknown): string[] {
    if (!input || typeof input !== 'object') {
      return [];
    }
    const patch = (input as Record<string, unknown>).patch;
    return typeof patch === 'string' ? extractPatchPaths(patch) : [];
  }

  async captureAfter(snapshot: FileChangeSnapshot): Promise<FileChangeRecord> {
    const after = await this.readTextFile(snapshot.path);
    const kind = this.getChangeKind(
      snapshot.beforeExists,
      after.exists,
      snapshot.beforeContent,
      after.content
    );

    return {
      toolName: snapshot.toolName,
      path: snapshot.path,
      relativePath: snapshot.relativePath,
      kind,
      beforeContent: snapshot.beforeContent,
      afterContent: after.content,
      diff: this.generateDiff(snapshot.beforeContent, after.content),
    };
  }

  private async readTextFile(filePath: string): Promise<{ exists: boolean; content: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        exists: true,
        content,
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

  private getChangeKind(
    beforeExists: boolean,
    afterExists: boolean,
    beforeContent: string,
    afterContent: string
  ): FileChangeKind {
    if (!beforeExists && afterExists) return 'created';
    if (beforeExists && !afterExists) return 'deleted';
    if (beforeExists && afterExists && beforeContent !== afterContent) return 'modified';
    return 'unchanged';
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

  private extractPath(input: unknown): string | undefined {
    if (!input || typeof input !== 'object') {
      return undefined;
    }

    const value = (input as Record<string, unknown>).path;
    return typeof value === 'string' ? value : undefined;
  }
}
