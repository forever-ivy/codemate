import { describe, expect, it } from 'vitest';
import { FailureRecoveryPromptService } from '../../../src/agents/FailureRecoveryPromptService';
import type { TaskCompletionDecision } from '../../../src/agents/TaskCompletionService';

describe('FailureRecoveryPromptService', () => {
  it('should skip recovery prompts for completed tasks', () => {
    const service = new FailureRecoveryPromptService();

    const prompt = service.build({
      userMessage: 'fix the type error',
      completion: createCompletion(true),
    });

    expect(prompt).toBeUndefined();
  });

  it('should build a focused prompt from completion blockers and verification evidence', () => {
    const service = new FailureRecoveryPromptService();

    const prompt = service.build({
      userMessage: 'fix the type error',
      completion: createCompletion(false),
      verification: {
        success: false,
        commands: [],
        summary: 'Verification failed.\nsrc/foo.ts(1,7): error TS2322',
      },
      fileChanges: [
        {
          toolName: 'edit_file',
          path: '/repo/src/foo.ts',
          relativePath: 'src/foo.ts',
          kind: 'modified',
          beforeContent: 'const value = 1;',
          afterContent: 'const value: number = "wrong";',
          diff: '- const value = 1;\n+ const value: number = "wrong";',
        },
      ],
      repair: {
        attempted: true,
        issues: [
          {
            source: 'npm run typecheck',
            message: 'Type error',
            raw: 'src/foo.ts(1,7): error TS2322: Type error',
            filePath: 'src/foo.ts',
            line: 1,
            column: 7,
          },
        ],
      },
    });

    expect(prompt).toContain('## Failure Recovery Prompt');
    expect(prompt).toContain('Original request:');
    expect(prompt).toContain('fix the type error');
    expect(prompt).toContain('- [VERIFICATION_FAILED] Final verification failed.');
    expect(prompt).toContain('- src/foo.ts (modified, via edit_file)');
    expect(prompt).toContain('src/foo.ts(1,7): error TS2322');
    expect(prompt).toContain('- Parsed verification issues: 1');
  });

  it('should cap changed files and truncate long verification summaries', () => {
    const service = new FailureRecoveryPromptService({
      maxChangedFiles: 1,
      maxVerificationSummaryChars: 18,
    });

    const prompt = service.build({
      userMessage: 'repair failing checks',
      completion: createCompletion(false),
      verification: {
        success: false,
        commands: [],
        summary: 'abcdefghijklmnopqrstuvwxyz',
      },
      fileChanges: [createChange('src/a.ts'), createChange('src/b.ts')],
    });

    expect(prompt).toContain('- src/a.ts (modified, via edit_file)');
    expect(prompt).toContain('- 1 more changed file omitted.');
    expect(prompt).toContain('abcdefghijklmnopqr\n...[truncated]');
  });
});

function createCompletion(complete: boolean): TaskCompletionDecision {
  return {
    contractVersion: 2,
    complete,
    status: complete ? 'complete' : 'incomplete',
    reasons: complete ? [] : ['Final verification failed.'],
    blockerCodes: complete ? [] : ['VERIFICATION_FAILED'],
    evidence: {
      response: { characterCount: 4 },
      fileChanges: { required: false, paths: complete ? [] : ['src/foo.ts'] },
      verification: {
        required: !complete,
        ran: !complete,
        ...(!complete ? { success: false, summary: 'Verification failed.' } : {}),
        commands: [],
      },
      repair: { attempted: false, resolved: true },
    },
    checks: [
      {
        name: 'response',
        required: true,
        status: 'satisfied',
        passed: true,
        detail: 'Assistant produced a response.',
        evidence: { characterCount: 4 },
      },
      {
        name: 'verification',
        required: !complete,
        status: complete ? 'not-required' : 'unsatisfied',
        passed: complete,
        detail: complete
          ? 'No effective file changes required verification.'
          : 'Final verification failed.',
        evidence: { required: !complete, ran: !complete, commands: [] },
        ...(!complete
          ? {
              blocker: {
                code: 'VERIFICATION_FAILED' as const,
                message: 'Final verification failed.',
                retryable: true,
              },
            }
          : {}),
      },
      {
        name: 'repair',
        required: false,
        status: 'not-required',
        passed: true,
        detail: 'No unresolved repair error.',
        evidence: { attempted: false, resolved: true },
      },
    ],
  };
}

function createChange(relativePath: string) {
  return {
    toolName: 'edit_file',
    path: `/repo/${relativePath}`,
    relativePath,
    kind: 'modified' as const,
    beforeContent: 'before',
    afterContent: 'after',
    diff: '- before\n+ after',
  };
}
