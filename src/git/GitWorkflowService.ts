import path from 'node:path';

export interface GitWorkflowServiceOptions {
  cwd: string;
  worktreeRoot?: string;
}

export interface GitWorkspaceStatus {
  isGitRepository: boolean;
  currentBranch?: string;
  hasUncommittedChanges: boolean;
  remote?: string;
}

export interface GitWorkflowPlanInput {
  taskTitle: string;
  baseBranch: string;
  branchName?: string;
  status: GitWorkspaceStatus;
  requireCleanWorkspace?: boolean;
}

export interface GitWorkflowStep {
  id:
    | 'verify-clean'
    | 'fetch-base'
    | 'create-worktree'
    | 'run-task'
    | 'verify'
    | 'commit'
    | 'push'
    | 'open-pr';
  title: string;
  command?: string[];
  description: string;
}

export interface GitWorkflowPlan {
  allowed: boolean;
  blockers: string[];
  baseBranch: string;
  branchName: string;
  worktreePath: string;
  steps: GitWorkflowStep[];
}

export interface PullRequestDraftInput {
  title: string;
  baseBranch: string;
  branchName: string;
  summary: string;
  changedFiles: string[];
  verification: string[];
}

export interface PullRequestDraft {
  title: string;
  baseBranch: string;
  branchName: string;
  body: string;
}

/**
 * GitWorkflowService creates safe, inspectable Git workflow plans.
 *
 * It intentionally does not execute Git commands. Commands are returned as
 * argv arrays so UI, headless CI, or approval layers can decide when to run
 * them.
 */
export class GitWorkflowService {
  constructor(private options: GitWorkflowServiceOptions) {}

  plan(input: GitWorkflowPlanInput): GitWorkflowPlan {
    const branchName = this.normalizeBranchName(input.branchName ?? input.taskTitle);
    const worktreeName = this.branchSlug(branchName);
    const worktreePath = path.resolve(this.worktreeRoot(), worktreeName);
    const blockers = this.findBlockers(input.status, input.requireCleanWorkspace ?? true);

    return {
      allowed: blockers.length === 0,
      blockers,
      baseBranch: input.baseBranch,
      branchName,
      worktreePath,
      steps:
        blockers.length === 0
          ? this.createSteps(input.baseBranch, branchName, worktreePath, input.status.remote)
          : [],
    };
  }

  createPullRequestDraft(input: PullRequestDraftInput): PullRequestDraft {
    return {
      title: input.title,
      baseBranch: input.baseBranch,
      branchName: input.branchName,
      body: [
        '## Summary',
        '',
        input.summary,
        '',
        '## Changed Files',
        '',
        ...this.formatList(input.changedFiles),
        '',
        '## Verification',
        '',
        ...this.formatList(input.verification),
      ].join('\n'),
    };
  }

  private findBlockers(status: GitWorkspaceStatus, requireCleanWorkspace: boolean): string[] {
    const blockers: string[] = [];
    if (!status.isGitRepository) {
      blockers.push('Current workspace is not a Git repository.');
    }
    if (requireCleanWorkspace && status.hasUncommittedChanges) {
      blockers.push(
        'Current workspace has uncommitted changes. Commit, stash, or use an existing isolated worktree first.'
      );
    }
    return blockers;
  }

  private createSteps(
    baseBranch: string,
    branchName: string,
    worktreePath: string,
    remote = 'origin'
  ): GitWorkflowStep[] {
    const remoteBase = `${remote}/${baseBranch}`;
    return [
      {
        id: 'verify-clean',
        title: 'Verify clean workspace',
        command: ['git', 'diff-index', '--quiet', 'HEAD', '--'],
        description: 'Ensure user changes are not mixed with the isolated task.',
      },
      {
        id: 'fetch-base',
        title: 'Fetch base branch',
        command: ['git', 'fetch', remote, baseBranch],
        description: 'Refresh the base branch before creating the worktree.',
      },
      {
        id: 'create-worktree',
        title: 'Create isolated worktree',
        command: ['git', 'worktree', 'add', '-b', branchName, worktreePath, remoteBase],
        description: 'Create a separate filesystem workspace for the task branch.',
      },
      {
        id: 'run-task',
        title: 'Run agent task',
        description: 'Execute the coding agent inside the isolated worktree.',
      },
      {
        id: 'verify',
        title: 'Run verification',
        description: 'Run focused tests and release-quality checks inside the worktree.',
      },
      {
        id: 'commit',
        title: 'Commit changes',
        command: ['git', 'commit'],
        description: 'Commit only the task changes after review.',
      },
      {
        id: 'push',
        title: 'Push branch',
        command: ['git', 'push', '-u', remote, branchName],
        description: 'Publish the task branch to the remote repository.',
      },
      {
        id: 'open-pr',
        title: 'Open pull request',
        description: 'Create a PR with summary, changed files, and verification evidence.',
      },
    ];
  }

  private normalizeBranchName(value: string): string {
    const slug = this.slug(value);
    return slug.startsWith('feat/') ? slug : `feat/${slug}`;
  }

  private branchSlug(branchName: string): string {
    return branchName.replace(/^feat\//, '').replace(/\//g, '-');
  }

  private slug(value: string): string {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
    return slug || 'task';
  }

  private worktreeRoot(): string {
    return (
      this.options.worktreeRoot ?? path.join(path.dirname(this.options.cwd), '.codemate-worktrees')
    );
  }

  private formatList(items: string[]): string[] {
    return items.length > 0 ? items.map((item) => `- ${item}`) : ['- none'];
  }
}
