import type { FileChangeRecord } from '../tools/FileChangeTracker';
import type { VerificationResult } from '../verification/VerificationService';
import type { AgentRunIntentDecision } from './AgentRunIntentService';

export type TaskCompletionStatus = 'complete' | 'incomplete';
export type TaskCompletionCheckName = 'response' | 'file-change' | 'verification' | 'repair';
export type TaskCompletionRequirementStatus = 'satisfied' | 'unsatisfied' | 'not-required';
export type TaskCompletionBlockerCode =
  | 'EMPTY_RESPONSE'
  | 'FILE_CHANGE_REQUIRED'
  | 'VERIFICATION_REQUIRED'
  | 'VERIFICATION_FAILED'
  | 'REPAIR_FAILED';

export interface TaskCompletionBlocker {
  code: TaskCompletionBlockerCode;
  message: string;
  retryable: boolean;
}

export interface TaskCompletionCheck {
  name: TaskCompletionCheckName;
  required: boolean;
  status: TaskCompletionRequirementStatus;
  /** Compatibility field for existing UI and recovery consumers. */
  passed: boolean;
  detail: string;
  evidence: Record<string, unknown>;
  blocker?: TaskCompletionBlocker;
}

export interface TaskCompletionEvidence {
  response: {
    characterCount: number;
  };
  fileChanges: {
    required: boolean;
    paths: string[];
  };
  verification: {
    required: boolean;
    ran: boolean;
    success?: boolean;
    commands: string[];
    summary?: string;
  };
  repair: {
    attempted: boolean;
    resolved: boolean;
    error?: string;
  };
}

export interface TaskCompletionDecision {
  contractVersion: 2;
  complete: boolean;
  status: TaskCompletionStatus;
  /** Compatibility messages; machine consumers should prefer blockerCodes. */
  reasons: string[];
  blockerCodes: TaskCompletionBlockerCode[];
  checks: TaskCompletionCheck[];
  evidence: TaskCompletionEvidence;
}

export interface TaskCompletionInput {
  responseContent: string;
  fileChanges?: FileChangeRecord[];
  verification?: VerificationResult;
  repairAttempted?: boolean;
  repairError?: string;
  intentDecision?: AgentRunIntentDecision;
}

/**
 * Converts observable run evidence into a deterministic completion contract.
 *
 * AgentLoop calls this after the optional repair pass. The service first
 * normalizes runtime facts, then derives requirements and blockers from those
 * facts. Model prose never satisfies file-change or verification requirements.
 */
export class TaskCompletionService {
  evaluate(input: TaskCompletionInput): TaskCompletionDecision {
    const evidence = this.buildEvidence(input);
    const checks = [
      this.evaluateResponse(evidence),
      this.evaluateFileChanges(evidence),
      this.evaluateVerification(evidence),
      this.evaluateRepair(evidence),
    ];
    const blockers = checks.flatMap((check) => (check.blocker ? [check.blocker] : []));
    const complete = blockers.length === 0;

    return {
      contractVersion: 2,
      complete,
      status: complete ? 'complete' : 'incomplete',
      reasons: blockers.map((blocker) => blocker.message),
      blockerCodes: blockers.map((blocker) => blocker.code),
      checks,
      evidence,
    };
  }

  private buildEvidence(input: TaskCompletionInput): TaskCompletionEvidence {
    const effectiveChanges = (input.fileChanges ?? []).filter(
      (change) => change.kind !== 'unchanged'
    );
    const changedPaths = [...new Set(effectiveChanges.map((change) => change.relativePath))];
    const verificationRequired = effectiveChanges.length > 0;
    const repairAttempted = input.repairAttempted === true || Boolean(input.repairError);

    return {
      response: {
        characterCount: input.responseContent.trim().length,
      },
      fileChanges: {
        required: input.intentDecision?.requiresFileChange === true,
        paths: changedPaths,
      },
      verification: {
        required: verificationRequired,
        ran: Boolean(input.verification),
        ...(input.verification ? { success: input.verification.success } : {}),
        commands: input.verification?.commands.map((command) => command.command) ?? [],
        ...(input.verification?.summary ? { summary: input.verification.summary } : {}),
      },
      repair: {
        attempted: repairAttempted,
        resolved: !input.repairError,
        ...(input.repairError ? { error: input.repairError } : {}),
      },
    };
  }

  private evaluateResponse(evidence: TaskCompletionEvidence): TaskCompletionCheck {
    const satisfied = evidence.response.characterCount > 0;
    const detail = satisfied ? 'Assistant produced a response.' : 'Assistant response was empty.';
    return this.createCheck(
      'response',
      true,
      satisfied,
      detail,
      evidence.response,
      satisfied ? undefined : this.blocker('EMPTY_RESPONSE', detail)
    );
  }

  private evaluateFileChanges(evidence: TaskCompletionEvidence): TaskCompletionCheck {
    const required = evidence.fileChanges.required;
    const satisfied = evidence.fileChanges.paths.length > 0;
    const detail = required
      ? satisfied
        ? 'Expected file changes were detected.'
        : 'Expected file changes, but no files were changed.'
      : 'No file changes required for this run intent.';

    return this.createCheck(
      'file-change',
      required,
      satisfied,
      detail,
      evidence.fileChanges,
      required && !satisfied ? this.blocker('FILE_CHANGE_REQUIRED', detail) : undefined
    );
  }

  private evaluateVerification(evidence: TaskCompletionEvidence): TaskCompletionCheck {
    const { required, ran, success } = evidence.verification;
    let detail = 'No effective file changes required verification.';
    let blocker: TaskCompletionBlocker | undefined;

    if (required && !ran) {
      detail = 'Changed files were not verified.';
      blocker = this.blocker('VERIFICATION_REQUIRED', detail);
    } else if (required && success !== true) {
      detail = 'Final verification failed.';
      blocker = this.blocker('VERIFICATION_FAILED', detail);
    } else if (required) {
      detail = 'Final verification passed.';
    }

    return this.createCheck(
      'verification',
      required,
      ran && success === true,
      detail,
      evidence.verification,
      blocker
    );
  }

  private evaluateRepair(evidence: TaskCompletionEvidence): TaskCompletionCheck {
    const { attempted, resolved, error } = evidence.repair;
    const detail = resolved ? 'No unresolved repair error.' : `Repair failed: ${error}`;
    return this.createCheck(
      'repair',
      attempted,
      resolved,
      detail,
      evidence.repair,
      resolved ? undefined : this.blocker('REPAIR_FAILED', detail)
    );
  }

  private createCheck(
    name: TaskCompletionCheckName,
    required: boolean,
    satisfied: boolean,
    detail: string,
    evidence: Record<string, unknown>,
    blocker?: TaskCompletionBlocker
  ): TaskCompletionCheck {
    const status: TaskCompletionRequirementStatus = required
      ? satisfied
        ? 'satisfied'
        : 'unsatisfied'
      : 'not-required';

    return {
      name,
      required,
      status,
      passed: status !== 'unsatisfied',
      detail,
      evidence,
      ...(blocker ? { blocker } : {}),
    };
  }

  private blocker(code: TaskCompletionBlockerCode, message: string): TaskCompletionBlocker {
    return {
      code,
      message,
      retryable: true,
    };
  }
}
