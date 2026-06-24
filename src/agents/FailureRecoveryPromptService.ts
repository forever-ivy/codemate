import type { FileChangeRecord } from '../tools/FileChangeTracker';
import type { VerificationResult } from '../verification/VerificationService';
import type { AgentRepairAttempt } from './AgentLoop';
import type { TaskCompletionDecision } from './TaskCompletionService';

export interface FailureRecoveryPromptOptions {
  maxChangedFiles?: number;
  maxVerificationSummaryChars?: number;
}

export interface FailureRecoveryPromptInput {
  userMessage: string;
  completion: TaskCompletionDecision;
  verification?: VerificationResult;
  repair?: AgentRepairAttempt;
  fileChanges?: FileChangeRecord[];
}

/**
 * Builds a compact handoff prompt when an AgentLoop run ends incomplete.
 *
 * The service does not trigger another repair by itself. It packages the
 * completion blockers, changed files and verification evidence so the next
 * model call, scheduler step or human operator can continue from facts rather
 * than from a vague failure message.
 */
export class FailureRecoveryPromptService {
  constructor(private options: FailureRecoveryPromptOptions = {}) {}

  build(input: FailureRecoveryPromptInput): string | undefined {
    if (input.completion.complete) {
      return undefined;
    }

    return [
      '## Failure Recovery Prompt',
      '',
      'Use this prompt to continue the repair from the last known evidence.',
      '',
      'Original request:',
      input.userMessage,
      '',
      'Completion blockers:',
      ...this.formatCompletionBlockers(input.completion),
      '',
      'Failed checks:',
      ...this.formatFailedChecks(input.completion),
      '',
      'Changed files:',
      ...this.formatChangedFiles(input.fileChanges ?? []),
      '',
      'Final verification summary:',
      this.truncate(input.verification?.summary ?? 'Verification did not run.'),
      '',
      'Repair context:',
      ...this.formatRepair(input.repair),
      '',
      'Next repair instructions:',
      '- Focus only on the completion blockers above.',
      '- Inspect the changed files and verification output before editing.',
      '- Make the smallest safe change needed to satisfy verification.',
      '- Run verification again before claiming the task is complete.',
    ].join('\n');
  }

  private formatFailedChecks(completion: TaskCompletionDecision): string[] {
    return this.formatList(
      completion.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.name}: ${check.detail}`)
    );
  }

  private formatCompletionBlockers(completion: TaskCompletionDecision): string[] {
    const codedBlockers = completion.checks
      .map((check) => check.blocker)
      .filter((blocker) => blocker !== undefined)
      .map((blocker) => `[${blocker.code}] ${blocker.message}`);

    // Compatibility fallback keeps recovery usable for persisted v1 results.
    return this.formatList(codedBlockers.length > 0 ? codedBlockers : completion.reasons);
  }

  private formatChangedFiles(fileChanges: FileChangeRecord[]): string[] {
    const changed = fileChanges.filter((change) => change.kind !== 'unchanged');
    if (changed.length === 0) {
      return ['- none'];
    }

    const maxChangedFiles = this.options.maxChangedFiles ?? 8;
    const lines = changed
      .slice(0, maxChangedFiles)
      .map((change) => `- ${change.relativePath} (${change.kind}, via ${change.toolName})`);
    const omitted = changed.length - lines.length;
    if (omitted > 0) {
      lines.push(`- ${omitted} more changed file${omitted === 1 ? '' : 's'} omitted.`);
    }

    return lines;
  }

  private formatRepair(repair?: AgentRepairAttempt): string[] {
    if (!repair?.attempted) {
      return ['- Repair attempted: no'];
    }

    const lines = [
      '- Repair attempted: yes',
      `- Parsed verification issues: ${repair.issues.length}`,
    ];
    if (repair.error) {
      lines.push(`- Repair error: ${repair.error}`);
    }
    if (repair.verification) {
      lines.push(`- Repair verification: ${repair.verification.success ? 'passed' : 'failed'}`);
    }

    return lines;
  }

  private formatList(items: string[]): string[] {
    if (items.length === 0) {
      return ['- none'];
    }

    return items.map((item) => `- ${item}`);
  }

  private truncate(value: string): string {
    const maxChars = this.options.maxVerificationSummaryChars ?? 2_000;
    if (value.length <= maxChars) {
      return value;
    }

    return `${value.slice(0, maxChars)}\n...[truncated]`;
  }
}
