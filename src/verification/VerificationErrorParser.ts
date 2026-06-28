import type { VerificationResult } from './VerificationService';

export interface VerificationIssue {
  file?: string;
  line?: number;
  column?: number;
  message: string;
  source: string;
}

/**
 * VerificationErrorParser turns raw verification output into structured issues
 * that can be passed back to the model for a focused repair attempt.
 */
export class VerificationErrorParser {
  parse(result: VerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const command of result.commands) {
      if (command.success) {
        continue;
      }

      const output = `${command.stderr}\n${command.stdout}`.trim();
      if (!output) {
        issues.push({
          message: `${command.command} failed with exit code ${command.exitCode}.`,
          source: command.command,
        });
        continue;
      }

      issues.push(...this.parseOutput(output, command.command));
    }

    return issues.slice(0, 10);
  }

  formatForPrompt(issues: VerificationIssue[]): string {
    if (issues.length === 0) {
      return '- No structured issues could be parsed. Use the raw verification output.';
    }

    return issues
      .map((issue, index) => {
        const location =
          issue.file && issue.line
            ? `${issue.file}:${issue.line}${issue.column ? `:${issue.column}` : ''}`
            : 'unknown location';
        return `${index + 1}. ${location}\n   ${issue.message}\n   Source: ${issue.source}`;
      })
      .join('\n');
  }

  private parseOutput(output: string, source: string): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const issue = this.parseLine(trimmed, source);
      if (issue) {
        issues.push(issue);
      }
    }

    if (issues.length === 0) {
      issues.push({
        message: output.slice(0, 1000),
        source,
      });
    }

    return issues;
  }

  private parseLine(line: string, source: string): VerificationIssue | undefined {
    const patterns = [
      /^(?<file>[^()\s][^()]*?)\((?<line>\d+),(?<column>\d+)\):\s*(?<message>.+)$/,
      /^(?<file>[^:\s][^:]*?):(?<line>\d+):(?<column>\d+):\s*(?<message>.+)$/,
      /^(?<file>[^:\s][^:]*?):(?<line>\d+):\s*(?<message>.+)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match?.groups) {
        continue;
      }

      return {
        file: match.groups.file,
        line: Number(match.groups.line),
        column: match.groups.column ? Number(match.groups.column) : undefined,
        message: match.groups.message,
        source,
      };
    }

    if (/error|failed|fail/i.test(line)) {
      return {
        message: line,
        source,
      };
    }

    return undefined;
  }
}
