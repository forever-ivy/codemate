import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'pathe';

export type ProjectInstructionScope = 'user' | 'repository' | 'directory';

export interface ProjectInstructionEntry {
  scope: ProjectInstructionScope;
  path: string;
  content: string;
  priority: number;
  truncated: boolean;
}

export interface ProjectInstructionSnapshot {
  generatedAt: number;
  entries: ProjectInstructionEntry[];
  prompt: string;
}

export interface ProjectInstructionOptions {
  userInstructionPath?: string;
  fileName?: string;
  maxBytesPerFile?: number;
  maxTotalBytes?: number;
}

/**
 * ProjectInstructionService discovers AGENTS.md instructions and formats them
 * for model input without mixing them into long-term memory.
 *
 * Priority order is intentionally explicit:
 * user-level -> repository-level -> deeper directory-level instructions.
 */
export class ProjectInstructionService {
  constructor(
    private cwd: string,
    private options: ProjectInstructionOptions = {}
  ) {}

  async build(targetDirectory = this.cwd): Promise<ProjectInstructionSnapshot> {
    const workspaceRoot = path.resolve(this.cwd);
    const target = this.resolveTargetDirectory(workspaceRoot, targetDirectory);
    const candidates = this.discoverCandidates(workspaceRoot, target);
    const entries: ProjectInstructionEntry[] = [];
    let remainingBytes = this.options.maxTotalBytes ?? 12_000;

    for (const candidate of candidates) {
      if (remainingBytes <= 0) {
        break;
      }

      const content = await this.readCandidate(candidate.filePath, remainingBytes);
      if (!content) {
        continue;
      }

      remainingBytes -= Buffer.byteLength(content.content, 'utf8');
      entries.push({
        scope: candidate.scope,
        path: candidate.displayPath,
        content: content.content,
        priority: candidate.priority,
        truncated: content.truncated,
      });
    }

    return {
      generatedAt: Date.now(),
      entries,
      prompt: this.formatPrompt(entries),
    };
  }

  private discoverCandidates(
    workspaceRoot: string,
    targetDirectory: string
  ): Array<{
    scope: ProjectInstructionScope;
    filePath: string;
    displayPath: string;
    priority: number;
  }> {
    const fileName = this.options.fileName ?? 'AGENTS.md';
    const candidates: Array<{
      scope: ProjectInstructionScope;
      filePath: string;
      displayPath: string;
      priority: number;
    }> = [];
    const userInstructionPath =
      this.options.userInstructionPath ?? path.join(homedir(), '.codemate', fileName);

    candidates.push({
      scope: 'user',
      filePath: userInstructionPath,
      displayPath: userInstructionPath,
      priority: 0,
    });
    candidates.push({
      scope: 'repository',
      filePath: path.join(workspaceRoot, fileName),
      displayPath: fileName,
      priority: 10,
    });

    const relativeTarget = path.relative(workspaceRoot, targetDirectory);
    const segments = relativeTarget && relativeTarget !== '.' ? relativeTarget.split('/') : [];
    let currentDirectory = workspaceRoot;
    segments.forEach((segment, index) => {
      currentDirectory = path.join(currentDirectory, segment);
      const filePath = path.join(currentDirectory, fileName);
      candidates.push({
        scope: 'directory',
        filePath,
        displayPath: path.relative(workspaceRoot, filePath),
        priority: 20 + index,
      });
    });

    return candidates;
  }

  private async readCandidate(
    filePath: string,
    remainingBytes: number
  ): Promise<{ content: string; truncated: boolean } | undefined> {
    try {
      await access(filePath);
    } catch {
      return undefined;
    }

    const raw = await readFile(filePath, 'utf8');
    const perFileLimit = this.options.maxBytesPerFile ?? 6_000;
    const byteLimit = Math.max(0, Math.min(perFileLimit, remainingBytes));
    const originalBytes = Buffer.byteLength(raw, 'utf8');
    const content = this.takeUtf8Bytes(raw, byteLimit);

    if (!content) {
      return undefined;
    }

    return {
      content,
      truncated: Buffer.byteLength(content, 'utf8') < originalBytes,
    };
  }

  private formatPrompt(entries: ProjectInstructionEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const lines = [
      '## Project Instructions',
      '',
      'Priority: later entries override earlier project instruction entries.',
      'These instructions guide coding style and workflow but do not override system safety rules or explicit user requests.',
      '',
    ];

    for (const entry of entries) {
      lines.push(`### ${entry.scope}: ${entry.path}`);
      lines.push(
        `Metadata: priority ${entry.priority}; truncated: ${entry.truncated ? 'true' : 'false'}`
      );
      lines.push(entry.content.trimEnd());
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  }

  private resolveTargetDirectory(workspaceRoot: string, targetDirectory: string): string {
    const resolved = path.resolve(targetDirectory);
    if (resolved === workspaceRoot || resolved.startsWith(`${workspaceRoot}/`)) {
      return resolved;
    }

    return workspaceRoot;
  }

  private takeUtf8Bytes(content: string, byteLimit: number): string {
    if (byteLimit <= 0) {
      return '';
    }

    let usedBytes = 0;
    let result = '';
    for (const char of content) {
      const charBytes = Buffer.byteLength(char, 'utf8');
      if (usedBytes + charBytes > byteLimit) {
        break;
      }
      usedBytes += charBytes;
      result += char;
    }

    return result;
  }
}
