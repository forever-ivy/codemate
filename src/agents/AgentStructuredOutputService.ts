import type { FileChangeRecord } from '../tools/FileChangeTracker';
import type { VerificationResult } from '../verification/VerificationService';
import type { AgentRunIntentDecision } from './AgentRunIntentService';
import type { AgentRepairAttempt } from './AgentLoop';
import type { TaskCompletionDecision } from './TaskCompletionService';

export type AgentStructuredOutputStatus = 'completed' | 'incomplete' | 'failed';

export interface AgentStructuredOutputVerification {
  success: boolean;
  summary: string;
  commands: Array<{
    name: string;
    command: string;
    success: boolean;
    exitCode: number;
  }>;
}

export interface AgentStructuredOutputRepair {
  attempted: boolean;
  issueCount: number;
  verificationSuccess?: boolean;
  error?: string;
}

export interface AgentStructuredOutput {
  schemaVersion: 1;
  runId: string;
  status: AgentStructuredOutputStatus;
  success: boolean;
  assistantMessage: string;
  changedFiles: string[];
  intent?: AgentRunIntentDecision;
  verification?: AgentStructuredOutputVerification;
  repair?: AgentStructuredOutputRepair;
  completion?: TaskCompletionDecision;
  failureRecoveryPrompt?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface AgentStructuredOutputInput {
  runId: string;
  status: AgentStructuredOutputStatus;
  success: boolean;
  assistantMessage: string;
  fileChanges?: FileChangeRecord[];
  intent?: AgentRunIntentDecision;
  verification?: VerificationResult;
  repair?: AgentRepairAttempt;
  completion?: TaskCompletionDecision;
  failureRecoveryPrompt?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentStructuredErrorInput {
  runId: string;
  error: string;
}

/**
 * Converts an AgentLoop run into a versioned machine-readable response.
 *
 * The assistant message remains human-readable markdown. This protocol gives
 * CLI UI, Harness, Replay and future schedulers stable fields so they do not
 * need to parse the markdown report to understand run status or evidence.
 */
export class AgentStructuredOutputService {
  build(input: AgentStructuredOutputInput): AgentStructuredOutput {
    return {
      schemaVersion: 1,
      runId: input.runId,
      status: input.status,
      success: input.success,
      assistantMessage: input.assistantMessage,
      changedFiles: this.formatChangedFiles(input.fileChanges ?? []),
      ...(input.intent ? { intent: input.intent } : {}),
      ...(input.verification ? { verification: this.formatVerification(input.verification) } : {}),
      ...(input.repair ? { repair: this.formatRepair(input.repair) } : {}),
      ...(input.completion ? { completion: input.completion } : {}),
      ...(input.failureRecoveryPrompt
        ? { failureRecoveryPrompt: input.failureRecoveryPrompt }
        : {}),
      ...(input.usage ? { usage: input.usage } : {}),
    };
  }

  buildError(input: AgentStructuredErrorInput): AgentStructuredOutput {
    return {
      schemaVersion: 1,
      runId: input.runId,
      status: 'failed',
      success: false,
      assistantMessage: `❌ Error: ${input.error}`,
      changedFiles: [],
      error: input.error,
    };
  }

  private formatChangedFiles(fileChanges: FileChangeRecord[]): string[] {
    const seen = new Set<string>();
    const changedFiles: string[] = [];

    for (const change of fileChanges) {
      if (change.kind === 'unchanged' || seen.has(change.relativePath)) {
        continue;
      }

      seen.add(change.relativePath);
      changedFiles.push(change.relativePath);
    }

    return changedFiles;
  }

  private formatVerification(verification: VerificationResult): AgentStructuredOutputVerification {
    return {
      success: verification.success,
      summary: verification.summary,
      commands: verification.commands.map((command) => ({
        name: command.name,
        command: command.command,
        success: command.success,
        exitCode: command.exitCode,
      })),
    };
  }

  private formatRepair(repair: AgentRepairAttempt): AgentStructuredOutputRepair {
    return {
      attempted: repair.attempted,
      issueCount: repair.issues.length,
      ...(repair.verification ? { verificationSuccess: repair.verification.success } : {}),
      ...(repair.error ? { error: repair.error } : {}),
    };
  }
}
