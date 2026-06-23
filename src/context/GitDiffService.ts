import { execFileSync } from 'node:child_process';

export type GitChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'unknown';

export interface GitChangedFile {
  path: string;
  status: GitChangeStatus;
}

export interface GitDiffSnapshot {
  changedFiles: GitChangedFile[];
  isGitRepository: boolean;
  error?: string;
}

/**
 * GitDiffService 读取当前仓库的工作区变更列表。
 *
 * 调用链路：
 * RepoMapService.build -> GitDiffService.getSnapshot -> RepoMap.gitDiff
 *
 * 本章只读取路径级 diff 信息，不读取完整 diff 内容。
 * 这样可以让上下文选择优先关注本地改动，同时避免把大段 diff 塞进 prompt。
 */
export class GitDiffService {
  constructor(private cwd: string) {}

  /**
   * 返回当前工作区的 Git 变更快照。
   */
  getSnapshot(): GitDiffSnapshot {
    try {
      // 1. 先确认 cwd 是否在 Git 仓库里。不是 Git 仓库时不报错，
      //    直接返回空快照，让 RepoMapService 继续按普通路径上下文工作。
      const gitRoot = this.runGit(['rev-parse', '--show-toplevel']).trim();
      if (!gitRoot) {
        return {
          changedFiles: [],
          isGitRepository: false,
        };
      }

      // 2. 使用 porcelain 输出是因为它比普通 status 更稳定，适合程序解析。
      //    --untracked-files=all 让新建文件也能进入上下文选择。
      const statusOutput = this.runGit(['status', '--porcelain=v1', '--untracked-files=all']);
      return {
        changedFiles: this.parseStatus(statusOutput),
        isGitRepository: true,
      };
    } catch (error) {
      return {
        changedFiles: [],
        isGitRepository: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 解析 git status --porcelain=v1 输出。
   */
  parseStatus(output: string): GitChangedFile[] {
    return output
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map((line) => this.parseStatusLine(line))
      .filter((file): file is GitChangedFile => Boolean(file));
  }

  private parseStatusLine(line: string): GitChangedFile | undefined {
    // 1. porcelain v1 前两列是 index/worktree 状态，第 3 列之后是路径。
    //    例如：` M src/foo.ts`、`A  src/foo.ts`、`?? src/new.ts`。
    const statusCode = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    if (!rawPath) {
      return undefined;
    }

    // 2. rename/copy 会形如 `old -> new`，上下文选择应该关注新路径。
    const normalizedPath = this.normalizePath(
      rawPath.includes(' -> ') ? (rawPath.split(' -> ').at(-1) ?? rawPath) : rawPath
    );
    return {
      path: normalizedPath,
      status: this.toStatus(statusCode),
    };
  }

  private toStatus(statusCode: string): GitChangeStatus {
    if (statusCode === '??') return 'untracked';
    if (statusCode.includes('R')) return 'renamed';
    if (statusCode.includes('C')) return 'copied';
    if (statusCode.includes('D')) return 'deleted';
    if (statusCode.includes('A')) return 'added';
    if (statusCode.includes('M')) return 'modified';
    return 'unknown';
  }

  private normalizePath(rawPath: string): string {
    return rawPath.replace(/^"|"$/g, '');
  }

  private runGit(args: string[]): string {
    return execFileSync('git', ['-C', this.cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
}
