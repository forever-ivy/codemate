import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GitWorkflowService } from '../../../src/git/GitWorkflowService';

describe('GitWorkflowService', () => {
  it('should plan an isolated worktree workflow for a task branch', () => {
    const service = new GitWorkflowService({
      cwd: '/repo/codemate',
      worktreeRoot: '/repo/.codemate-worktrees',
    });

    const plan = service.plan({
      taskTitle: 'Add eval release gate',
      baseBranch: 'main',
      status: {
        isGitRepository: true,
        currentBranch: 'main',
        hasUncommittedChanges: false,
        remote: 'origin',
      },
    });

    expect(plan.allowed).toBe(true);
    expect(plan.branchName).toBe('feat/add-eval-release-gate');
    expect(plan.worktreePath).toBe(path.resolve('/repo/.codemate-worktrees/add-eval-release-gate'));
    expect(plan.steps.map((step) => step.id)).toEqual([
      'verify-clean',
      'fetch-base',
      'create-worktree',
      'run-task',
      'verify',
      'commit',
      'push',
      'open-pr',
    ]);
    expect(plan.steps.find((step) => step.id === 'create-worktree')?.command).toEqual([
      'git',
      'worktree',
      'add',
      '-b',
      'feat/add-eval-release-gate',
      path.resolve('/repo/.codemate-worktrees/add-eval-release-gate'),
      'origin/main',
    ]);
  });

  it('should block isolated workflow when the current workspace has uncommitted changes', () => {
    const service = new GitWorkflowService({ cwd: '/repo/codemate' });

    const plan = service.plan({
      taskTitle: 'Fix sidebar',
      baseBranch: 'main',
      status: {
        isGitRepository: true,
        currentBranch: 'main',
        hasUncommittedChanges: true,
        remote: 'origin',
      },
    });

    expect(plan.allowed).toBe(false);
    expect(plan.blockers).toEqual([
      'Current workspace has uncommitted changes. Commit, stash, or use an existing isolated worktree first.',
    ]);
    expect(plan.steps).toEqual([]);
  });

  it('should build PR metadata with changed files and verification evidence', () => {
    const service = new GitWorkflowService({ cwd: '/repo/codemate' });

    const pr = service.createPullRequestDraft({
      title: 'Add release gate',
      baseBranch: 'main',
      branchName: 'feat/add-release-gate',
      changedFiles: [
        'src/harness/ReleaseGateService.ts',
        'tests/unit/harness/ReleaseGateService.test.ts',
      ],
      verification: ['pnpm run quality:release'],
      summary: 'Adds release gate checks for benchmark reports.',
    });

    expect(pr).toEqual({
      title: 'Add release gate',
      baseBranch: 'main',
      branchName: 'feat/add-release-gate',
      body: [
        '## Summary',
        '',
        'Adds release gate checks for benchmark reports.',
        '',
        '## Changed Files',
        '',
        '- src/harness/ReleaseGateService.ts',
        '- tests/unit/harness/ReleaseGateService.test.ts',
        '',
        '## Verification',
        '',
        '- pnpm run quality:release',
      ].join('\n'),
    });
  });

  it('should sanitize unsafe branch names and worktree paths', () => {
    const service = new GitWorkflowService({
      cwd: '/repo/codemate',
      worktreeRoot: '/repo/.codemate-worktrees',
    });

    const plan = service.plan({
      taskTitle: '../../Deploy PROD!!!',
      baseBranch: 'main',
      status: {
        isGitRepository: true,
        currentBranch: 'main',
        hasUncommittedChanges: false,
        remote: 'origin',
      },
    });

    expect(plan.branchName).toBe('feat/deploy-prod');
    expect(plan.worktreePath).toBe(path.resolve('/repo/.codemate-worktrees/deploy-prod'));
  });
});
