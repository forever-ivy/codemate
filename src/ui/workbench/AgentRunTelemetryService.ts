import type { TaskItem } from '../components/TaskTracker';
import type { AgentTimelineKind } from './AgentTimelineService';

export interface AgentRunTelemetry {
  totalDurationMs: number;
  slowestActivity: string;
  slowestDurationMs: number;
  byKind: Partial<Record<AgentTimelineKind, number>>;
}

/**
 * Aggregates completed live activities into a compact run telemetry snapshot.
 *
 * This is intentionally a summary layer, not a trace viewer. Raw tool details
 * remain in the runtime/tool trace services while completed terminal summaries
 * keep only enough timing evidence to diagnose slow runs.
 */
export function buildAgentRunTelemetry(tasks: TaskItem[]): AgentRunTelemetry | undefined {
  const timedTasks = tasks
    .map((task) => {
      if (task.startTime === undefined || task.endTime === undefined) {
        return undefined;
      }

      const durationMs = Math.max(0, task.endTime - task.startTime);
      return { task, durationMs };
    })
    .filter((item): item is { task: TaskItem; durationMs: number } => Boolean(item));

  if (timedTasks.length === 0) {
    return undefined;
  }

  const startedAt = Math.min(...timedTasks.map(({ task }) => task.startTime ?? 0));
  const completedAt = Math.max(...timedTasks.map(({ task }) => task.endTime ?? 0));
  const slowest = timedTasks.reduce((current, item) =>
    item.durationMs > current.durationMs ? item : current
  );
  const intervalsByKind = new Map<AgentTimelineKind, Array<[number, number]>>();

  for (const { task } of timedTasks) {
    const intervals = intervalsByKind.get(task.kind) ?? [];
    intervals.push([task.startTime ?? 0, task.endTime ?? 0]);
    intervalsByKind.set(task.kind, intervals);
  }

  const byKind: Partial<Record<AgentTimelineKind, number>> = {};
  for (const [kind, intervals] of intervalsByKind) {
    byKind[kind] = mergedDuration(intervals);
  }

  return {
    totalDurationMs: Math.max(0, completedAt - startedAt),
    slowestActivity: slowest.task.description,
    slowestDurationMs: slowest.durationMs,
    byKind,
  };
}

function mergedDuration(intervals: Array<[number, number]>): number {
  const sorted = [...intervals].sort(([left], [right]) => left - right);
  let total = 0;
  let currentStart: number | undefined;
  let currentEnd: number | undefined;

  for (const [start, end] of sorted) {
    if (currentStart === undefined || currentEnd === undefined) {
      currentStart = start;
      currentEnd = end;
      continue;
    }

    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
      continue;
    }

    total += Math.max(0, currentEnd - currentStart);
    currentStart = start;
    currentEnd = end;
  }

  if (currentStart !== undefined && currentEnd !== undefined) {
    total += Math.max(0, currentEnd - currentStart);
  }

  return total;
}

export function formatAgentRunTelemetry(telemetry?: AgentRunTelemetry): string | undefined {
  if (!telemetry) {
    return undefined;
  }

  const kindParts = Object.entries(telemetry.byKind)
    .filter(([, duration]) => duration > 0)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([kind, duration]) => `${displayKind(kind)} ${formatDuration(duration)}`);

  return [
    `total ${formatDuration(telemetry.totalDurationMs)}`,
    `slowest ${telemetry.slowestActivity} ${formatDuration(telemetry.slowestDurationMs)}`,
    kindParts.join(', '),
  ]
    .filter(Boolean)
    .join(' · ');
}

function displayKind(kind: string): string {
  if (kind === 'verification') {
    return 'verify';
  }

  return kind;
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(1)}s`;
}
