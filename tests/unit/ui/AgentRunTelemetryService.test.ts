import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../../../src/ui/components/TaskTracker';
import {
  buildAgentRunTelemetry,
  formatAgentRunTelemetry,
} from '../../../src/ui/workbench/AgentRunTelemetryService';

describe('AgentRunTelemetryService', () => {
  it('aggregates total duration, slowest activity and duration by kind', () => {
    const telemetry = buildAgentRunTelemetry([
      timedTask('model-1', 'Thinking', 'model', 1_000, 1_500),
      timedTask('tool-1', 'edit(src/App.tsx)', 'tool', 1_600, 4_100),
      timedTask('verify-1', 'bash(pnpm run typecheck)', 'verification', 4_200, 5_100),
    ]);

    expect(telemetry).toMatchObject({
      totalDurationMs: 4_100,
      slowestActivity: 'edit(src/App.tsx)',
      slowestDurationMs: 2_500,
      byKind: {
        model: 500,
        tool: 2_500,
        verification: 900,
      },
    });
  });

  it('formats telemetry for compact run summaries', () => {
    const telemetry = buildAgentRunTelemetry([
      timedTask('tool-1', 'edit(src/App.tsx)', 'tool', 1_000, 3_500),
      timedTask('verify-1', 'bash(pnpm run typecheck)', 'verification', 3_600, 4_500),
    ]);

    expect(formatAgentRunTelemetry(telemetry)).toBe(
      'total 3.5s · slowest edit(src/App.tsx) 2.5s · tool 2.5s, verify 900ms'
    );
  });

  it('returns undefined when there is no completed duration evidence', () => {
    expect(
      buildAgentRunTelemetry([
        {
          id: 'tool-running',
          kind: 'tool',
          description: 'edit(src/App.tsx)',
          status: 'running',
          startTime: 1_000,
        } as TaskItem,
      ])
    ).toBeUndefined();
  });

  it('merges overlapping activity intervals instead of double-counting them', () => {
    const telemetry = buildAgentRunTelemetry([
      timedTask('tool-1', 'Writing file', 'tool', 1_000, 4_000),
      timedTask('tool-2', 'Writing file completed', 'tool', 1_500, 3_500),
      timedTask('verify-1', 'Running verification', 'verification', 4_000, 5_000),
    ]);

    expect(telemetry).toMatchObject({
      totalDurationMs: 4_000,
      byKind: {
        tool: 3_000,
        verification: 1_000,
      },
    });
  });
});

function timedTask(
  id: string,
  description: string,
  kind: TaskItem['kind'],
  startTime: number,
  endTime: number
): TaskItem {
  return {
    id,
    description,
    kind,
    status: 'completed',
    startTime,
    endTime,
  };
}
