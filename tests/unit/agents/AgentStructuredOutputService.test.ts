import { describe, expect, it } from 'vitest';
import { AgentStructuredOutputService } from '../../../src/agents/AgentStructuredOutputService';
import type { TaskCompletionDecision } from '../../../src/agents/TaskCompletionService';

describe('AgentStructuredOutputService', () => {
  const service = new AgentStructuredOutputService();

  it('should build a versioned structured output for completed runs', () => {
    const output = service.build({
      runId: 'agent-run-1',
      status: 'completed',
      success: true,
      assistantMessage: 'Done',
      fileChanges: [createChange('src/foo.ts')],
      verification: {
        success: true,
        commands: [],
        summary: 'Verification passed.',
      },
      completion: createCompletion(true),
      intent: {
        intent: 'code-change',
        requiresFileChange: true,
        requiresVerification: true,
        reason: 'test code change',
      },
    });

    expect(output).toMatchObject({
      schemaVersion: 1,
      runId: 'agent-run-1',
      status: 'completed',
      success: true,
      assistantMessage: 'Done',
      changedFiles: ['src/foo.ts'],
      verification: {
        success: true,
        summary: 'Verification passed.',
      },
      completion: {
        contractVersion: 2,
        status: 'complete',
        blockerCodes: [],
      },
      intent: {
        intent: 'code-change',
        requiresFileChange: true,
      },
    });
  });

  it('should include recovery prompt and blockers for incomplete runs', () => {
    const output = service.build({
      runId: 'agent-run-2',
      status: 'incomplete',
      success: false,
      assistantMessage: 'Could not finish.',
      completion: createCompletion(false),
      failureRecoveryPrompt: '## Failure Recovery Prompt',
    });

    expect(output.status).toBe('incomplete');
    expect(output.completion.contractVersion).toBe(2);
    expect(output.completion.blockerCodes).toEqual(['VERIFICATION_FAILED']);
    expect(output.completion.reasons).toEqual(['Final verification failed.']);
    expect(output.failureRecoveryPrompt).toBe('## Failure Recovery Prompt');
  });

  it('should build structured output for failed runtime errors', () => {
    const output = service.buildError({
      runId: 'agent-run-3',
      error: 'model failed',
    });

    expect(output).toEqual({
      schemaVersion: 1,
      runId: 'agent-run-3',
      status: 'failed',
      success: false,
      assistantMessage: '❌ Error: model failed',
      changedFiles: [],
      error: 'model failed',
    });
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
      verification: { required: !complete, ran: !complete, commands: [] },
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
