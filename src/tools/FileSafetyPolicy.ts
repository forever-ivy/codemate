import * as path from 'pathe';
import { extractPatchPaths } from './patch/UnifiedPatchService';

export interface FileSafetyDecision {
  allowed: boolean;
  path?: string;
  reason: string;
}

/**
 * FileSafetyPolicy protects the workspace boundary for file-mutating tools.
 */
export class FileSafetyPolicy {
  private mutationTools = new Set([
    'write_file',
    'edit_file',
    'edit_code',
    'apply_patch',
    'delete_file',
  ]);
  private protectedDirs = new Set(['.git', 'node_modules']);

  isFileMutationTool(toolName: string): boolean {
    return this.mutationTools.has(toolName);
  }

  check(toolName: string, input: unknown, cwd: string): FileSafetyDecision {
    if (!this.isFileMutationTool(toolName)) {
      return {
        allowed: true,
        reason: 'Tool does not mutate files.',
      };
    }

    const targetPaths = this.extractPaths(toolName, input);
    if (targetPaths.length === 0) {
      return {
        allowed: false,
        reason: `${toolName} must include a string path or valid patch.`,
      };
    }

    for (const targetPath of targetPaths) {
      const absolutePath = path.resolve(cwd, targetPath);
      const relativePath = path.relative(cwd, absolutePath);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          allowed: false,
          path: absolutePath,
          reason: `Refusing to modify a path outside the workspace: ${targetPath}`,
        };
      }

      const pathParts = relativePath.split(/[\\/]+/);
      const protectedDir = pathParts.find((part) => this.protectedDirs.has(part));
      if (protectedDir) {
        return {
          allowed: false,
          path: absolutePath,
          reason: `Refusing to modify protected directory: ${protectedDir}`,
        };
      }
    }

    return {
      allowed: true,
      ...(targetPaths.length === 1 ? { path: path.resolve(cwd, targetPaths[0]) } : {}),
      reason:
        targetPaths.length === 1
          ? 'Path is inside the workspace.'
          : 'All patch paths are inside the workspace.',
    };
  }

  private extractPath(input: unknown): string | undefined {
    if (!input || typeof input !== 'object') {
      return undefined;
    }

    const value = (input as Record<string, unknown>).path;
    return typeof value === 'string' ? value : undefined;
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
}
