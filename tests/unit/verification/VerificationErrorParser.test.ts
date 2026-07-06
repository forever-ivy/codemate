import { describe, expect, it } from 'vitest';
import { VerificationErrorParser } from '../../../src/verification/VerificationErrorParser';
import type { VerificationResult } from '../../../src/verification/VerificationService';

describe('VerificationErrorParser', () => {
  it('should parse TypeScript style file locations', () => {
    const parser = new VerificationErrorParser();
    const result: VerificationResult = {
      success: false,
      summary: 'Verification failed',
      commands: [
        {
          name: 'typecheck',
          command: 'npm run typecheck',
          success: false,
          exitCode: 1,
          stdout: '',
          stderr:
            "src/foo.ts(12,8): error TS2322: Type 'string' is not assignable to type 'number'.",
          durationMs: 10,
        },
      ],
    };

    expect(parser.parse(result)).toEqual([
      {
        file: 'src/foo.ts',
        line: 12,
        column: 8,
        message: "error TS2322: Type 'string' is not assignable to type 'number'.",
        source: 'npm run typecheck',
      },
    ]);
  });

  it('should parse colon separated file locations', () => {
    const parser = new VerificationErrorParser();
    const result: VerificationResult = {
      success: false,
      summary: 'Verification failed',
      commands: [
        {
          name: 'test',
          command: 'npm run test',
          success: false,
          exitCode: 1,
          stdout: 'tests/foo.test.ts:5:13: expected true to be false',
          stderr: '',
          durationMs: 10,
        },
      ],
    };

    expect(parser.parse(result)).toEqual([
      {
        file: 'tests/foo.test.ts',
        line: 5,
        column: 13,
        message: 'expected true to be false',
        source: 'npm run test',
      },
    ]);
  });

  it('should fall back to raw output when no structured location is found', () => {
    const parser = new VerificationErrorParser();
    const result: VerificationResult = {
      success: false,
      summary: 'Verification failed',
      commands: [
        {
          name: 'build',
          command: 'npm run build',
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: 'Build failed unexpectedly',
          durationMs: 10,
        },
      ],
    };

    expect(parser.parse(result)).toEqual([
      {
        message: 'Build failed unexpectedly',
        source: 'npm run build',
      },
    ]);
  });
});
