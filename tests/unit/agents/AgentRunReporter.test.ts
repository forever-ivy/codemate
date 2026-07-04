import { describe, expect, it } from 'vitest';
import { AgentRunReporter } from '../../../src/agents/AgentRunReporter';

describe('AgentRunReporter', () => {
  it('should keep the response unchanged when there is nothing to report', () => {
    const reporter = new AgentRunReporter();

    expect(reporter.build({ responseContent: 'Done' })).toBe('Done');
  });

  it('should append changed files and verification details', () => {
    const reporter = new AgentRunReporter();

    const report = reporter.build({
      responseContent: 'Created the service.',
      fileChanges: [
        {
          toolName: 'write_file',
          path: '/repo/src/service.ts',
          relativePath: 'src/service.ts',
          kind: 'created',
          beforeContent: '',
          afterContent: 'export const value = 1;',
          diff: '+ export const value = 1;',
        },
      ],
      finalVerification: {
        success: true,
        commands: [
          {
            name: 'typecheck',
            command: 'npm run typecheck',
            success: true,
            exitCode: 0,
            stdout: '',
            stderr: '',
            durationMs: 12,
          },
        ],
        summary: 'Verification passed:\n- PASS npm run typecheck (12ms)',
      },
    });

    expect(report).toContain('## Task Report');
    expect(report).toContain('Changed files:');
    expect(report).toContain('- src/service.ts (created, via write_file)');
    expect(report).toContain('Verification passed:');
    expect(report).toContain('- PASS npm run typecheck (12ms)');
  });

  it('should report repair attempts with final verification status', () => {
    const reporter = new AgentRunReporter();

    const report = reporter.build({
      responseContent: 'Fixed the implementation.',
      initialVerification: {
        success: false,
        commands: [],
        summary: 'Verification failed',
      },
      finalVerification: {
        success: true,
        commands: [],
        summary: 'Verification passed',
      },
      repair: {
        attempted: true,
        response: {
          content: 'Fixed the type error',
          model: 'test-model',
        },
        verification: {
          success: true,
          commands: [],
          summary: 'Verification passed',
        },
        issues: [
          {
            source: 'npm run typecheck',
            message: 'Type error',
            raw: 'src/foo.ts(1,1): error TS2322: Type error',
            filePath: 'src/foo.ts',
            line: 1,
            column: 1,
          },
        ],
      },
    });

    expect(report).toContain('Verification failed before repair.');
    expect(report).toContain('Final verification passed:');
    expect(report).toContain('Repair attempt: attempted');
    expect(report).toContain('- Issues found: 1');
    expect(report).toContain('- Repair response: Fixed the type error');
  });

  it('should append a recovery prompt when completion conditions are not met', () => {
    const reporter = new AgentRunReporter();

    const report = reporter.build({
      responseContent: 'I could not finish the repair.',
      failureRecoveryPrompt:
        '## Failure Recovery Prompt\n\nCompletion blockers:\n- Final verification failed.',
    });

    expect(report).toContain('## Task Report');
    expect(report).toContain('Recovery: required');
    expect(report).toContain('## Failure Recovery Prompt');
    expect(report).toContain('- Final verification failed.');
  });

  it('should report incomplete code-change runs even when no files changed', () => {
    const reporter = new AgentRunReporter();

    const report = reporter.build({
      responseContent: 'I added the requested menu.',
      intent: {
        intent: 'code-change',
        requiresFileChange: true,
        requiresVerification: true,
        reason: 'The request asks for a workspace change.',
      },
      completion: {
        contractVersion: 2,
        complete: false,
        status: 'incomplete',
        reasons: ['Expected file changes, but no files were changed.'],
        blockerCodes: ['FILE_CHANGE_REQUIRED'],
        evidence: {
          response: { characterCount: 27 },
          fileChanges: { required: true, paths: [] },
          verification: { required: false, ran: false, commands: [] },
          repair: { attempted: false, resolved: true },
        },
        checks: [
          {
            name: 'response',
            required: true,
            status: 'satisfied',
            passed: true,
            detail: 'Assistant produced a response.',
            evidence: { characterCount: 27 },
          },
          {
            name: 'file-change',
            required: true,
            status: 'unsatisfied',
            passed: false,
            detail: 'Expected file changes, but no files were changed.',
            evidence: { required: true, paths: [] },
            blocker: {
              code: 'FILE_CHANGE_REQUIRED',
              message: 'Expected file changes, but no files were changed.',
              retryable: true,
            },
          },
          {
            name: 'verification',
            required: false,
            status: 'not-required',
            passed: true,
            detail: 'No effective file changes required verification.',
            evidence: { required: false, ran: false, commands: [] },
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
      },
      fileChanges: [],
    });

    expect(report).toContain('## Task Report');
    expect(report).toContain('Run intent: code-change');
    expect(report).toContain('Changed files: none');
    expect(report).toContain('Completion incomplete:');
    expect(report).toContain(
      '- [FILE_CHANGE_REQUIRED] Expected file changes, but no files were changed.'
    );
  });
});
