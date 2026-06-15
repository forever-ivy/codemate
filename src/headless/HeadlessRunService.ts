import type { AgentLoop, AgentLoopEvent, AgentLoopResult } from '../agents/AgentLoop';
import type { AgentStructuredOutput } from '../agents/AgentStructuredOutputService';
import type { EventBus } from '../services/EventBus';

export type HeadlessRunFormat = 'json' | 'stream-json';

export interface HeadlessRunOptions {
  message: string;
  format: HeadlessRunFormat;
  timeoutMs?: number;
}

export interface HeadlessRunResult {
  exitCode: number;
  output: AgentStructuredOutput;
  timedOut: boolean;
}

export type HeadlessJsonStreamEvent =
  | {
      schemaVersion: 1;
      type: 'run_started';
      message: string;
      timestamp: number;
    }
  | {
      schemaVersion: 1;
      type: 'agent_event';
      event: AgentLoopEvent;
      timestamp: number;
    }
  | {
      schemaVersion: 1;
      type: 'run_completed';
      output: AgentStructuredOutput;
      timestamp: number;
    };

export interface HeadlessRunServiceDependencies {
  agentLoop: Pick<AgentLoop, 'execute'> & Partial<Pick<AgentLoop, 'cancelActiveRun'>>;
  eventBus: Pick<EventBus, 'on' | 'off'>;
  write?: (line: string) => void;
  now?: () => number;
}

/**
 * Runs AgentLoop without Ink and emits a stable machine-readable protocol.
 *
 * The service is intentionally small: AgentLoop owns coding behavior, while
 * this layer owns JSON output, JSONL streaming and process-style exit codes.
 */
export class HeadlessRunService {
  private write: (line: string) => void;
  private now: () => number;

  constructor(private deps: HeadlessRunServiceDependencies) {
    this.write = deps.write ?? ((line) => process.stdout.write(`${line}\n`));
    this.now = deps.now ?? Date.now;
  }

  async run(options: HeadlessRunOptions): Promise<HeadlessRunResult> {
    const eventHandler = (event: AgentLoopEvent) => {
      if (options.format === 'stream-json') {
        this.writeJson({
          schemaVersion: 1,
          type: 'agent_event',
          event,
          timestamp: this.now(),
        });
      }
    };

    if (options.format === 'stream-json') {
      this.writeJson({
        schemaVersion: 1,
        type: 'run_started',
        message: options.message,
        timestamp: this.now(),
      });
      this.deps.eventBus.on('agent_loop_event', eventHandler);
    }

    try {
      const result = await this.executeWithTimeout(options);
      const output = this.outputFromResult(result);

      if (options.format === 'stream-json') {
        this.writeJson({
          schemaVersion: 1,
          type: 'run_completed',
          output,
          timestamp: this.now(),
        });
      } else {
        this.writeJson(output);
      }

      return {
        exitCode: this.exitCodeForOutput(output),
        output,
        timedOut: false,
      };
    } catch (error) {
      const output = this.outputFromError(error);
      if (options.format === 'stream-json') {
        this.writeJson({
          schemaVersion: 1,
          type: 'run_completed',
          output,
          timestamp: this.now(),
        });
      } else {
        this.writeJson(output);
      }

      return {
        exitCode: error instanceof HeadlessTimeoutError ? 124 : 1,
        output,
        timedOut: error instanceof HeadlessTimeoutError,
      };
    } finally {
      if (options.format === 'stream-json') {
        this.deps.eventBus.off('agent_loop_event', eventHandler);
      }
    }
  }

  private async executeWithTimeout(options: HeadlessRunOptions): Promise<AgentLoopResult> {
    if (!options.timeoutMs || options.timeoutMs <= 0) {
      return this.deps.agentLoop.execute(options.message);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        this.deps.agentLoop.cancelActiveRun?.();
        reject(new HeadlessTimeoutError(options.timeoutMs ?? 0));
      }, options.timeoutMs);
    });

    try {
      return await Promise.race([this.deps.agentLoop.execute(options.message), timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private outputFromResult(result: AgentLoopResult): AgentStructuredOutput {
    if (result.structuredOutput) {
      return result.structuredOutput;
    }

    return {
      schemaVersion: 1,
      runId: result.runId,
      status: result.success ? 'completed' : 'failed',
      success: result.success,
      assistantMessage: result.response?.content ?? result.error ?? '',
      changedFiles: result.fileChanges?.map((change) => change.relativePath) ?? [],
      ...(result.error ? { error: result.error } : {}),
    };
  }

  private outputFromError(error: unknown): AgentStructuredOutput {
    const message = error instanceof Error ? error.message : 'Unknown headless run error';
    return {
      schemaVersion: 1,
      runId: `headless-run-${this.now()}`,
      status: 'failed',
      success: false,
      assistantMessage: `Error: ${message}`,
      changedFiles: [],
      error: message,
    };
  }

  private exitCodeForOutput(output: AgentStructuredOutput): number {
    if (output.success && output.status === 'completed') {
      return 0;
    }

    if (output.status === 'incomplete') {
      return 2;
    }

    return 1;
  }

  private writeJson(value: unknown): void {
    this.write(JSON.stringify(value));
  }
}

class HeadlessTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Headless run timed out after ${timeoutMs}ms.`);
    this.name = 'HeadlessTimeoutError';
  }
}
