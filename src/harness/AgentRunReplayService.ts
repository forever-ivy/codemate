import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import type { ToolTraceRecord } from '../tools/ToolTraceService';
import type { MiniHarnessTask, MiniHarnessTaskResult } from './MiniHarnessService';

const replayEventTypeSchema = z.enum([
  'run_started',
  'model_input',
  'tool_result',
  'file_changes',
  'verification',
  'response',
  'run_completed',
]);

const replayEventSchema = z.object({
  sequence: z.number().int().positive(),
  type: replayEventTypeSchema,
  timestamp: z.number().nonnegative(),
  data: z.unknown(),
});

const replayExpectationSchema = z.object({
  agentSuccess: z.boolean().optional(),
  modelInputIncludes: z.array(z.string()).optional(),
  changedFiles: z.array(z.string()).optional(),
  verificationSuccess: z.boolean().optional(),
  responseIncludes: z.array(z.string()).optional(),
});

const replayRecordSchema = z.object({
  version: z.literal(1),
  runId: z.string().min(1),
  createdAt: z.number().nonnegative(),
  task: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    userMessage: z.string().min(1),
    expected: replayExpectationSchema,
  }),
  result: z.object({
    success: z.boolean(),
    checks: z.array(
      z.object({
        name: z.string(),
        success: z.boolean(),
        expected: z.string(),
        actual: z.string(),
      })
    ),
    error: z.string().optional(),
  }),
  events: z.array(replayEventSchema),
});

export type AgentRunReplayEventType = z.infer<typeof replayEventTypeSchema>;
export type AgentRunReplayEvent = z.infer<typeof replayEventSchema>;
export type AgentRunReplayRecord = z.infer<typeof replayRecordSchema>;

export interface AgentRunReplaySummary {
  runId: string;
  taskId: string;
  success: boolean;
  eventCount: number;
}

export type AgentRunReplayHandler = (event: AgentRunReplayEvent) => void | Promise<void>;

export interface AgentRunReplayOptions {
  storageDir: string;
  now?: () => number;
  idFactory?: (taskId: string, timestamp: number) => string;
}

/**
 * AgentRunReplayService persists deterministic run events and replays them
 * without calling the model or executing tools again.
 */
export class AgentRunReplayService {
  private now: () => number;
  private idFactory: (taskId: string, timestamp: number) => string;

  constructor(private options: AgentRunReplayOptions) {
    this.now = options.now ?? Date.now;
    this.idFactory = options.idFactory ?? ((taskId, timestamp) => `replay-${taskId}-${timestamp}`);
  }

  async record(
    task: MiniHarnessTask,
    result: MiniHarnessTaskResult,
    toolTraces: ToolTraceRecord[] = []
  ): Promise<AgentRunReplayRecord> {
    const createdAt = this.now();
    const runId = this.idFactory(task.id, createdAt);
    this.assertReplayId(runId);

    const record: AgentRunReplayRecord = {
      version: 1,
      runId,
      createdAt,
      task: {
        id: task.id,
        title: task.title,
        ...(task.description ? { description: task.description } : {}),
        userMessage: task.userMessage,
        expected: task.expected,
      },
      result: {
        success: result.success,
        checks: result.checks,
        ...(result.error ? { error: result.error } : {}),
      },
      events: this.buildEvents(task, result, toolTraces, createdAt),
    };

    await this.save(record);
    return record;
  }

  async save(record: AgentRunReplayRecord): Promise<void> {
    const parsed = replayRecordSchema.parse(record);
    this.assertReplayId(parsed.runId);
    await fs.mkdir(this.options.storageDir, { recursive: true });

    const targetPath = this.getRecordPath(parsed.runId);
    const temporaryPath = `${targetPath}.tmp-${process.pid}-${this.now()}`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
    await fs.rename(temporaryPath, targetPath);
  }

  async load(runId: string): Promise<AgentRunReplayRecord> {
    this.assertReplayId(runId);
    const content = await fs.readFile(this.getRecordPath(runId), 'utf-8');
    const parsedJson = JSON.parse(content) as unknown;
    const parsed = replayRecordSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(`Invalid agent run replay record: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  async list(taskId?: string): Promise<AgentRunReplayRecord[]> {
    const entries = await fs.readdir(this.options.storageDir).catch(() => []);
    const records: AgentRunReplayRecord[] = [];

    for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
      const record = await this.load(entry.slice(0, -'.json'.length));
      if (!taskId || record.task.id === taskId) {
        records.push(record);
      }
    }

    return records.sort((a, b) => a.createdAt - b.createdAt);
  }

  async replay(runId: string, handler: AgentRunReplayHandler): Promise<AgentRunReplaySummary> {
    const record = await this.load(runId);
    const events = [...record.events].sort((a, b) => a.sequence - b.sequence);

    for (const event of events) {
      await handler(event);
    }

    return {
      runId: record.runId,
      taskId: record.task.id,
      success: record.result.success,
      eventCount: events.length,
    };
  }

  private buildEvents(
    task: MiniHarnessTask,
    result: MiniHarnessTaskResult,
    toolTraces: ToolTraceRecord[],
    createdAt: number
  ): AgentRunReplayEvent[] {
    const events: AgentRunReplayEvent[] = [];
    const addEvent = (
      type: AgentRunReplayEventType,
      data: unknown,
      timestamp = createdAt
    ): void => {
      events.push({
        sequence: events.length + 1,
        type,
        timestamp,
        data,
      });
    };

    addEvent('run_started', {
      taskId: task.id,
      title: task.title,
      userMessage: task.userMessage,
    });

    if (result.agentRun?.modelInput !== undefined) {
      addEvent('model_input', { content: result.agentRun.modelInput });
    }

    for (const trace of [...toolTraces].sort((a, b) => a.sequence - b.sequence)) {
      addEvent('tool_result', trace, trace.timestamp);
    }

    if (result.agentRun?.changedFiles !== undefined) {
      addEvent('file_changes', { files: result.agentRun.changedFiles });
    }

    if (result.agentRun?.verification !== undefined) {
      addEvent('verification', result.agentRun.verification);
    }

    if (result.agentRun?.responseContent !== undefined) {
      addEvent('response', { content: result.agentRun.responseContent });
    }

    addEvent('run_completed', {
      success: result.success,
      checks: result.checks,
      ...(result.error ? { error: result.error } : {}),
    });

    return events;
  }

  private getRecordPath(runId: string): string {
    return path.join(this.options.storageDir, `${runId}.json`);
  }

  private assertReplayId(runId: string): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(runId)) {
      throw new Error(`Invalid replay id: ${runId}`);
    }
  }
}
