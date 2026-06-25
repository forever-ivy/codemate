import * as fs from 'node:fs/promises';
import { type StructuredPatch, applyPatch, parsePatch } from 'diff';
import * as path from 'pathe';

export type PatchChangeKind = 'created' | 'modified' | 'deleted';

export interface PatchFilePreview {
  path: string;
  absolutePath: string;
  kind: PatchChangeKind;
  beforeExists: boolean;
  beforeContent: string;
  afterContent: string;
}

export interface PatchPreview {
  files: PatchFilePreview[];
}

export interface PatchApplyResult {
  success: true;
  files: Array<{
    path: string;
    kind: PatchChangeKind;
    bytesWritten: number;
  }>;
}

/**
 * Extracts normalized repository-relative paths from a unified patch.
 * This helper is shared by policy layers so preview and execution inspect the
 * same patch payload.
 */
export function extractPatchPaths(patchText: string): string[] {
  return parseFilePatches(patchText).map(({ relativePath }) => relativePath);
}

/**
 * Parses, preflights and applies unified patches inside one workspace.
 */
export class UnifiedPatchService {
  private protectedDirectories = new Set(['.git', 'node_modules']);

  constructor(private cwd: string) {}

  async preview(patchText: string): Promise<PatchPreview> {
    const filePatches = parseFilePatches(patchText);
    const seenPaths = new Set<string>();
    const files: PatchFilePreview[] = [];

    for (const filePatch of filePatches) {
      await this.assertSafePath(filePatch.relativePath);
      if (seenPaths.has(filePatch.relativePath)) {
        throw new Error(`Patch contains duplicate target path: ${filePatch.relativePath}`);
      }
      seenPaths.add(filePatch.relativePath);

      const absolutePath = path.resolve(this.cwd, filePatch.relativePath);
      const before = await this.readTextFile(absolutePath);
      this.assertSourceState(filePatch, before.exists);

      const afterContent = applyPatch(before.content, filePatch.patch, {
        autoConvertLineEndings: true,
      });
      if (afterContent === false) {
        throw new Error(`Patch for ${filePatch.relativePath} does not apply cleanly.`);
      }

      files.push({
        path: filePatch.relativePath,
        absolutePath,
        kind: filePatch.kind,
        beforeExists: before.exists,
        beforeContent: before.content,
        afterContent,
      });
    }

    return { files };
  }

  async apply(patchText: string): Promise<PatchApplyResult> {
    const preview = await this.preview(patchText);
    const applied: PatchFilePreview[] = [];

    try {
      for (const file of preview.files) {
        if (file.kind === 'deleted') {
          await fs.unlink(file.absolutePath);
        } else {
          await fs.mkdir(path.dirname(file.absolutePath), { recursive: true });
          await fs.writeFile(file.absolutePath, file.afterContent, 'utf-8');
        }
        applied.push(file);
      }
    } catch (error) {
      await this.rollback(applied);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to apply patch; applied changes were rolled back: ${message}`);
    }

    return {
      success: true,
      files: preview.files.map((file) => ({
        path: file.path,
        kind: file.kind,
        bytesWritten: file.kind === 'deleted' ? 0 : Buffer.byteLength(file.afterContent, 'utf-8'),
      })),
    };
  }

  private async assertSafePath(relativePath: string): Promise<void> {
    const absolutePath = path.resolve(this.cwd, relativePath);
    const normalizedRelativePath = path.relative(this.cwd, absolutePath);

    if (normalizedRelativePath.startsWith('..') || path.isAbsolute(normalizedRelativePath)) {
      throw new Error(`Patch path is outside the workspace: ${relativePath}`);
    }

    const protectedDirectory = normalizedRelativePath
      .split(/[\\/]+/)
      .find((part) => this.protectedDirectories.has(part));
    if (protectedDirectory) {
      throw new Error(`Patch targets protected directory: ${protectedDirectory}`);
    }

    // Lexical checks do not catch `workspace/link -> /outside`. Resolve the
    // target, or its nearest existing parent for new files, before any read or
    // write so a patch cannot escape through a symbolic link.
    const realCwd = await fs.realpath(this.cwd);
    const existingPath = await this.findNearestExistingPath(absolutePath);
    const realExistingPath = await fs.realpath(existingPath);
    const realRelativePath = path.relative(realCwd, realExistingPath);
    if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
      throw new Error(
        `Patch path resolves through a symbolic link outside the workspace: ${relativePath}`
      );
    }
  }

  private async findNearestExistingPath(filePath: string): Promise<string> {
    let candidate = filePath;

    while (true) {
      try {
        await fs.lstat(candidate);
        return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }

        const parent = path.dirname(candidate);
        if (parent === candidate) {
          throw new Error(`Cannot resolve patch path: ${filePath}`);
        }
        candidate = parent;
      }
    }
  }

  private assertSourceState(filePatch: ParsedFilePatch, sourceExists: boolean): void {
    if (filePatch.kind === 'created' && sourceExists) {
      throw new Error(`Cannot create existing file: ${filePatch.relativePath}`);
    }
    if (filePatch.kind !== 'created' && !sourceExists) {
      throw new Error(`Patch source file does not exist: ${filePatch.relativePath}`);
    }
  }

  private async rollback(files: PatchFilePreview[]): Promise<void> {
    for (const file of [...files].reverse()) {
      if (!file.beforeExists) {
        await fs.rm(file.absolutePath, { force: true });
        continue;
      }

      await fs.mkdir(path.dirname(file.absolutePath), { recursive: true });
      await fs.writeFile(file.absolutePath, file.beforeContent, 'utf-8');
    }
  }

  private async readTextFile(filePath: string): Promise<{ exists: boolean; content: string }> {
    try {
      return { exists: true, content: await fs.readFile(filePath, 'utf-8') };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { exists: false, content: '' };
      }
      throw error;
    }
  }
}

interface ParsedFilePatch {
  patch: StructuredPatch;
  relativePath: string;
  kind: PatchChangeKind;
}

function parseFilePatches(patchText: string): ParsedFilePatch[] {
  if (!patchText.trim()) {
    throw new Error('Patch must not be empty.');
  }

  let patches: StructuredPatch[];
  try {
    patches = parsePatch(patchText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid unified patch: ${message}`);
  }

  if (patches.length === 0) {
    throw new Error('Patch does not contain valid file changes.');
  }

  return patches.map((patch) => {
    if (patch.isBinary) {
      throw new Error('Binary patches are not supported.');
    }
    if (patch.isRename || patch.isCopy) {
      throw new Error('Rename and copy patches are not supported.');
    }
    if (patch.hunks.length === 0) {
      throw new Error('Patch does not contain valid file changes.');
    }

    const oldPath = normalizePatchPath(patch.oldFileName);
    const newPath = normalizePatchPath(patch.newFileName);
    const kind: PatchChangeKind = !oldPath ? 'created' : !newPath ? 'deleted' : 'modified';
    const relativePath = newPath ?? oldPath;

    if (!relativePath) {
      throw new Error('Patch file header does not contain a usable path.');
    }
    if (oldPath && newPath && oldPath !== newPath) {
      throw new Error('Patch cannot change a file path; use an explicit move operation.');
    }

    return { patch, relativePath, kind };
  });
}

function normalizePatchPath(fileName: string | undefined): string | undefined {
  if (!fileName || fileName === '/dev/null') {
    return undefined;
  }

  const withoutPrefix = fileName.replace(/^[ab][\\/]/, '');
  return withoutPrefix.replace(/\\/g, '/').replace(/^\.\//, '');
}
