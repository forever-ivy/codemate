import { describe, expect, it } from 'vitest';
import { TaskCompletionService } from '../../../src/agents/TaskCompletionService';

describe('TaskCompletionService', () => {
  const service = new TaskCompletionService();

  it('should complete a response-only task without requiring verification', () => {
    const decision = service.evaluate({
      responseContent: 'The service builds repository context.',
      fileChanges: [],
    });

    expect(decision.complete).toBe(true);
    expect(decision.contractVersion).toBe(2);
    expect(decision.status).toBe('complete');
    expect(decision.reasons).toEqual([]);
    expect(decision.blockerCodes).toEqual([]);
    expect(decision.evidence).toEqual({
      response: { characterCount: 38 },
      fileChanges: { required: false, paths: [] },
      verification: { required: false, ran: false, commands: [] },
      repair: { attempted: false, resolved: true },
    });
    expect(decision.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'file-change',
          required: false,
          status: 'not-required',
          passed: true,
        }),
      ])
    );
  });

  it('should keep a code-change task incomplete when no files changed', () => {
    const decision = service.evaluate({
      responseContent: 'I added the requested menu.',
      fileChanges: [],
      intentDecision: createIntentDecision('code-change'),
    });

    expect(decision.complete).toBe(false);
    expect(decision.status).toBe('incomplete');
    expect(decision.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'file-change', passed: false })])
    );
    expect(decision.reasons).toContain('Expected file changes, but no files were changed.');
    expect(decision.blockerCodes).toContain('FILE_CHANGE_REQUIRED');
    expect(decision.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'file-change',
          required: true,
          status: 'unsatisfied',
          blocker: {
            code: 'FILE_CHANGE_REQUIRED',
            message: 'Expected file changes, but no files were changed.',
            retryable: true,
          },
        }),
      ])
    );
  });

  it('should allow an answer-only task to complete without file changes', () => {
    const decision = service.evaluate({
      responseContent: 'A coding agent plans, edits, verifies, and reports.',
      fileChanges: [],
      intentDecision: createIntentDecision('answer-only'),
    });

    expect(decision.complete).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('should complete a changed task only after final verification passes', () => {
    const decision = service.evaluate({
      responseContent: 'Implemented the change.',
      fileChanges: [createFileChange()],
      verification: {
        success: true,
        commands: [],
        summary: 'Verification passed.',
      },
    });

    expect(decision.complete).toBe(true);
    expect(decision.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'verification',
          required: true,
          status: 'satisfied',
          passed: true,
          evidence: {
            required: true,
            ran: true,
            success: true,
            commands: [],
            summary: 'Verification passed.',
          },
        }),
      ])
    );
    expect(decision.evidence.fileChanges.paths).toEqual(['src/example.ts']);
  });

  it('should keep changed code incomplete when verification did not run', () => {
    const decision = service.evaluate({
      responseContent: 'Implemented the change.',
      fileChanges: [createFileChange()],
    });

    expect(decision.complete).toBe(false);
    expect(decision.status).toBe('incomplete');
    expect(decision.reasons).toContain('Changed files were not verified.');
    expect(decision.blockerCodes).toEqual(['VERIFICATION_REQUIRED']);
  });

  it('should keep the task incomplete when repair leaves verification failing', () => {
    const decision = service.evaluate({
      responseContent: 'Tried to repair the change.',
      fileChanges: [createFileChange()],
      verification: {
        success: false,
        commands: [],
        summary: 'Verification failed.',
      },
      repairError: 'repair tool failed',
      repairAttempted: true,
    });

    expect(decision.complete).toBe(false);
    expect(decision.reasons).toEqual([
      'Final verification failed.',
      'Repair failed: repair tool failed',
    ]);
    expect(decision.blockerCodes).toEqual(['VERIFICATION_FAILED', 'REPAIR_FAILED']);
    expect(decision.evidence.repair).toEqual({
      attempted: true,
      resolved: false,
      error: 'repair tool failed',
    });
  });

  it('should use a stable blocker code for an empty response', () => {
    const decision = service.evaluate({ responseContent: '   ' });

    expect(decision.blockerCodes).toEqual(['EMPTY_RESPONSE']);
    expect(decision.checks[0]).toMatchObject({
      name: 'response',
      required: true,
      status: 'unsatisfied',
      evidence: { characterCount: 0 },
    });
  });
});

function createFileChange() {
  return {
    toolName: 'edit_file',
    path: '/repo/src/example.ts',
    relativePath: 'src/example.ts',
    kind: 'modified' as const,
    beforeContent: 'export const value = 1;',
    afterContent: 'export const value = 2;',
    diff: '- export const value = 1;\n+ export const value = 2;',
  };
}

function createIntentDecision(intent: 'answer-only' | 'inspect-only' | 'code-change') {
  return {
    intent,
    requiresFileChange: intent === 'code-change',
    requiresVerification: intent === 'code-change',
    reason: `test ${intent}`,
  };
}
