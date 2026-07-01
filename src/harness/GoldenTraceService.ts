import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import type { AgentRunReplayEvent, AgentRunReplayRecord } from './AgentRunReplayService';

const goldenTraceEventSchema = z.object({
  sequence: z.number().int().positive(),
  type: z.enum([
    'run_started',
    'model_input',
    'tool_result',
    'file_changes',
    'verification',
    'response',
    'run_completed',
  ]),
  data: z.record(z.unknown()),
});

const goldenTraceSchema = z.object({
  version: z.literal(1),
  taskId: z.string().min(1),
  createdFromRunId: z.string().min(1),
  events: z.array(goldenTraceEventSchema),
});

export type GoldenTraceEvent = z.infer<typeof goldenTraceEventSchema>;
export type GoldenTrace = z.infer<typeof goldenTraceSchema>;

export interface GoldenTraceMismatch {
  path: string;
  expected: string;
  actual: string;
}

export interface GoldenTraceComparison {
  taskId: string;
  success: boolean;
  mismatches: GoldenTraceMismatch[];
}

export interface GoldenTraceOptions {
  goldenDir: string;
}

/**
 * GoldenTraceService converts replay records into stable event projections.
 * Dynamic timestamps, durations, full prompts, and outputs are intentionally
 * excluded so regression checks focus on behavior rather than run noise.
 */
export class GoldenTraceService {
  constructor(private options: GoldenTraceOptions) {}

  create(record: AgentRunReplayRecord): GoldenTrace {
    return {
      version: 1,
      taskId: record.task.id,
      createdFromRunId: record.runId,
      events: [...record.events]
        .sort((a, b) => a.sequence - b.sequence)
        .map((event, index) => ({
          sequence: index + 1,
          type: event.type,
          data: this.normalizeEventData(event),
        })),
    };
  }

  async save(trace: GoldenTrace): Promise<void> {
    const parsed = goldenTraceSchema.parse(trace);
    this.assertTaskId(parsed.taskId);
    await fs.mkdir(this.options.goldenDir, { recursive: true });

    const targetPath = this.getTracePath(parsed.taskId);
    const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
    await fs.rename(temporaryPath, targetPath);
  }

  async load(taskId: string): Promise<GoldenTrace> {
    this.assertTaskId(taskId);
    const content = await fs.readFile(this.getTracePath(taskId), 'utf-8');
    const parsed = goldenTraceSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsed.success) {
      throw new Error(`Invalid golden trace: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  compare(record: AgentRunReplayRecord, golden: GoldenTrace): GoldenTraceComparison {
    const actual = this.create(record);
    const mismatches: GoldenTraceMismatch[] = [];

    if (actual.taskId !== golden.taskId) {
      mismatches.push({
        path: 'taskId',
        expected: golden.taskId,
        actual: actual.taskId,
      });
    }

    if (actual.events.length !== golden.events.length) {
      mismatches.push({
        path: 'events.length',
        expected: String(golden.events.length),
        actual: String(actual.events.length),
      });
    }

    const eventCount = Math.min(actual.events.length, golden.events.length);
    for (let index = 0; index < eventCount; index++) {
      const expectedEvent = golden.events[index];
      const actualEvent = actual.events[index];

      if (actualEvent.type !== expectedEvent.type) {
        mismatches.push({
          path: `events[${index}].type`,
          expected: expectedEvent.type,
          actual: actualEvent.type,
        });
        continue;
      }

      const expectedData = this.stableStringify(expectedEvent.data);
      const actualData = this.stableStringify(actualEvent.data);
      if (actualData !== expectedData) {
        mismatches.push({
          path: `events[${index}].data`,
          expected: expectedData,
          actual: actualData,
        });
      }
    }

    return {
      taskId: golden.taskId,
      success: mismatches.length === 0,
      mismatches,
    };
  }

  private normalizeEventData(event: AgentRunReplayEvent): Record<string, unknown> {
    const data = this.asRecord(event.data);

    switch (event.type) {
      case 'run_started':
        return { taskId: this.asString(data.taskId) };
      case 'model_input':
      case 'response':
        return { present: this.hasContent(data.content) };
      case 'tool_result':
        return {
          ok: data.ok === true,
          toolName: this.asString(data.toolName),
        };
      case 'file_changes':
        return {
          files: this.asStringArray(data.files).sort(),
        };
      case 'verification':
      case 'run_completed':
        return { success: data.success === true };
      default:
        return this.assertNever(event.type);
    }
  }

  private stableStringify(value: unknown): string {
    return JSON.stringify(this.sortValue(value));
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.sortValue(item)])
      );
    }
    return value;
  }

  private getTracePath(taskId: string): string {
    return path.join(this.options.goldenDir, `${taskId}.golden.json`);
  }

  private assertTaskId(taskId: string): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(taskId)) {
      throw new Error(`Invalid golden trace task id: ${taskId}`);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private hasContent(value: unknown): boolean {
    return typeof value === 'string' && value.length > 0;
  }

  private assertNever(value: never): never {
    throw new Error(`Unsupported replay event type: ${String(value)}`);
  }
}
