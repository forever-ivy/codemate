import type { FileChangeRecord } from '../tools/FileChangeTracker';
import type { AIResponse } from '../types/index';
import type { VerificationIssue } from '../verification/VerificationErrorParser';
import type { VerificationResult } from '../verification/VerificationService';
import type { AgentRunIntentDecision } from './AgentRunIntentService';
import type { TaskCompletionDecision } from './TaskCompletionService';

export interface AgentRunReportRepair {
  attempted: boolean;
  response?: AIResponse;
  verification?: VerificationResult;
  issues: VerificationIssue[];
  fileChanges?: FileChangeRecord[];
  error?: string;
}

export interface AgentRunReportInput {
  responseContent: string;
  intent?: AgentRunIntentDecision;
  completion?: TaskCompletionDecision;
  fileChanges?: FileChangeRecord[];
  initialVerification?: VerificationResult;
  finalVerification?: VerificationResult;
  repair?: AgentRunReportRepair;
  failureRecoveryPrompt?: string;
}

/**
 * AgentRunReporter turns internal run details into a concise user-facing
 * completion report.
 */
export class AgentRunReporter {
  build(input: AgentRunReportInput): string {
    if (!this.shouldAppendReport(input)) {
      return input.responseContent;
    }

    const sections = [
      input.responseContent,
      '---',
      '## Task Report',
      '',
      ...this.formatIntent(input.intent),
      '',
      ...this.formatChangedFiles(input.fileChanges ?? [], input.repair?.fileChanges ?? []),
      '',
      ...this.formatVerification(input.initialVerification, input.finalVerification),
      '',
      ...this.formatCompletion(input.completion),
      '',
      ...this.formatRepair(input.repair),
      '',
      ...this.formatRecovery(input.failureRecoveryPrompt),
    ];

    return this.trimBlankLines(sections).join('\n');
  }

  private shouldAppendReport(input: AgentRunReportInput): boolean {
    return Boolean(
      (input.fileChanges && input.fileChanges.length > 0) ||
        input.initialVerification ||
        input.finalVerification ||
        input.repair?.attempted ||
        input.intent?.intent === 'code-change' ||
        input.completion?.complete === false ||
        input.failureRecoveryPrompt
    );
  }

  private formatIntent(intent?: AgentRunIntentDecision): string[] {
    if (!intent) {
      return ['Run intent: unknown'];
    }

    return [
      `Run intent: ${intent.intent}`,
      `- Requires file changes: ${intent.requiresFileChange}`,
      `- Requires verification: ${intent.requiresVerification}`,
    ];
  }

  private formatChangedFiles(
    initialChanges: FileChangeRecord[],
    repairChanges: FileChangeRecord[]
  ): string[] {
    const changes = [...initialChanges, ...repairChanges];

    if (changes.length === 0) {
      return ['Changed files: none'];
    }

    const lines = ['Changed files:'];
    const seen = new Set<string>();

    for (const change of changes) {
      const key = `${change.kind}:${change.relativePath}:${change.toolName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      lines.push(`- ${change.relativePath} (${change.kind}, via ${change.toolName})`);

      const diffPreview = this.formatDiffPreview(change.diff);
      if (diffPreview) {
        lines.push(diffPreview);
      }
    }

    return lines;
  }

  private formatDiffPreview(diff: string): string | undefined {
    const lines = diff
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)
      .slice(0, 6);

    if (lines.length === 0) {
      return undefined;
    }

    return lines.map((line) => `  ${line}`).join('\n');
  }

  private formatVerification(
    initialVerification?: VerificationResult,
    finalVerification?: VerificationResult
  ): string[] {
    const verification = finalVerification ?? initialVerification;

    if (!verification) {
      return ['Verification: not run'];
    }

    if (initialVerification && finalVerification && initialVerification !== finalVerification) {
      return [
        `Verification ${initialVerification.success ? 'passed' : 'failed'} before repair.`,
        ...this.formatSingleVerification('Final verification', finalVerification),
      ];
    }

    return this.formatSingleVerification('Verification', verification);
  }

  private formatSingleVerification(label: string, verification: VerificationResult): string[] {
    const status = verification.success ? 'passed' : 'failed';
    const lines = [`${label} ${status}:`];

    for (const command of verification.commands) {
      const marker = command.success ? 'PASS' : 'FAIL';
      lines.push(`- ${marker} ${command.command} (${command.durationMs}ms)`);
    }

    if (verification.commands.length === 0) {
      lines.push(`- ${verification.summary}`);
    }

    return lines;
  }

  private formatRepair(repair?: AgentRunReportRepair): string[] {
    if (!repair?.attempted) {
      return ['Repair: not needed'];
    }

    if (repair.error) {
      return [`Repair attempt: failed (${repair.error})`];
    }

    const lines = ['Repair attempt: attempted'];
    lines.push(`- Issues found: ${repair.issues.length}`);

    if (repair.response?.content) {
      lines.push(`- Repair response: ${repair.response.content}`);
    }

    if (repair.verification) {
      lines.push(`- Repair verification: ${repair.verification.success ? 'passed' : 'failed'}`);
    }

    return lines;
  }

  private formatCompletion(completion?: TaskCompletionDecision): string[] {
    if (!completion) {
      return ['Completion: not evaluated'];
    }

    const label = completion.complete ? 'complete' : 'incomplete';
    const lines = [`Completion ${label}:`];

    if (completion.reasons.length === 0) {
      lines.push('- All completion checks passed.');
      return lines;
    }

    const codedBlockers = completion.checks
      .map((check) => check.blocker)
      .filter((blocker) => blocker !== undefined);
    if (codedBlockers.length > 0) {
      for (const blocker of codedBlockers) {
        lines.push(`- [${blocker.code}] ${blocker.message}`);
      }
      return lines;
    }

    // Compatibility fallback for persisted version 1 completion decisions.
    for (const reason of completion.reasons) {
      lines.push(`- ${reason}`);
    }

    return lines;
  }

  private formatRecovery(failureRecoveryPrompt?: string): string[] {
    if (!failureRecoveryPrompt?.trim()) {
      return ['Recovery: not needed'];
    }

    return ['Recovery: required', '', failureRecoveryPrompt.trim()];
  }

  private trimBlankLines(lines: string[]): string[] {
    const trimmed = [...lines];

    while (trimmed.length > 0 && trimmed[0] === '') {
      trimmed.shift();
    }

    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
      trimmed.pop();
    }

    return trimmed;
  }
}
