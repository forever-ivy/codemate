import type { AgentStructuredOutput } from '../../agents/AgentStructuredOutputService';
import { type AgentRunTelemetry, formatAgentRunTelemetry } from './AgentRunTelemetryService';

export interface AgentRunSummary {
  id: string;
  result: AgentStructuredOutput['status'];
  summary?: string;
  changedFiles: string[];
  verification: string;
  showEvidence: boolean;
  tokens?: string;
  telemetry?: string;
  error?: string;
}

/**
 * Projects a completed AgentLoop output into a compact terminal summary.
 *
 * 调用链路：
 * AgentLoop.execute -> AppContent.handleSubmit -> buildAgentRunSummary ->
 * AgentRunSummaryList
 *
 * The summary intentionally keeps only final result, changed files and
 * verification evidence. Full tool traces stay in debug/session data so the
 * main terminal surface does not repaint a long completed timeline.
 */
export function buildAgentRunSummary(
  output: AgentStructuredOutput,
  telemetry?: AgentRunTelemetry
): AgentRunSummary {
  const telemetryText = formatAgentRunTelemetry(telemetry);
  const summary = conciseSummary(output.assistantMessage);

  return {
    id: output.runId,
    result: output.status,
    ...(summary ? { summary } : {}),
    changedFiles: output.changedFiles,
    verification: output.verification?.summary ?? 'Not run',
    showEvidence: shouldShowEvidence(output),
    ...(output.usage ? { tokens: formatTokenUsage(output.usage) } : {}),
    ...(telemetryText ? { telemetry: telemetryText } : {}),
    ...(output.error ? { error: output.error } : {}),
  };
}

function shouldShowEvidence(output: AgentStructuredOutput): boolean {
  if (output.status !== 'completed' || output.error) {
    return true;
  }

  return output.changedFiles.length > 0 || Boolean(output.verification);
}

function formatTokenUsage(usage: NonNullable<AgentStructuredOutput['usage']>): string {
  return [
    `prompt ${formatTokenCount(usage.promptTokens)}`,
    `completion ${formatTokenCount(usage.completionTokens)}`,
    `total ${formatTokenCount(usage.totalTokens)}`,
  ].join(' · ');
}

function formatTokenCount(count: number): string {
  if (count < 1_000) {
    return String(count);
  }

  return `${(count / 1_000).toFixed(1)}k`;
}

function conciseSummary(message: string): string | undefined {
  const humanAnswer = message.split(/\n---\n|\n## Task Report\b/)[0]?.trim();
  if (!humanAnswer) {
    return undefined;
  }

  const singleLine = stripMarkdown(humanAnswer)
    .replace(/^#+\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!singleLine) {
    return undefined;
  }

  const maxLength = 240;
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength - 1).trimEnd()}…`
    : singleLine;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}
