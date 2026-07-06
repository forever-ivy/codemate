import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../../../src/ui/components/TaskTracker';
import {
  buildAgentTimeline,
  buildGroupedAgentTimeline,
} from '../../../src/ui/workbench/AgentTimelineService';

describe('AgentTimelineService', () => {
  it('should use explicit task kinds instead of classifying descriptions', () => {
    const tasks: TaskItem[] = [
      createTask('run-plan-1', 'Inspect repository structure', 'plan', 'completed'),
      createTask('tool-read-1', 'read_file src/ui/App.tsx', 'tool', 'completed'),
      createTask('verify-1', 'Running typecheck verification', 'verification', 'running'),
      createTask('repair-1', 'Repairing failed verification', 'repair', 'pending'),
    ];

    const timeline = buildAgentTimeline(tasks, 'Running typecheck verification');

    expect(timeline.map((item) => item.kind)).toEqual(['plan', 'tool', 'verification', 'repair']);
    expect(timeline[2]).toMatchObject({
      status: 'running',
      title: 'Running typecheck verification',
      current: true,
    });
  });

  it('should calculate completed activity duration', () => {
    const timeline = buildAgentTimeline([
      {
        id: 'tool-bash-1',
        kind: 'verification',
        description: 'bash pnpm run typecheck',
        status: 'completed',
        startTime: 1_000,
        endTime: 2_550,
      } as TaskItem,
    ]);

    expect(timeline[0].durationMs).toBe(1_550);
  });

  it('should calculate running activity duration from an injected clock', () => {
    const timeline = buildAgentTimeline(
      [
        {
          id: 'tool-edit-1',
          kind: 'tool',
          description: 'edit(src/App.tsx)',
          status: 'running',
          startTime: 1_000,
        } as TaskItem,
      ],
      undefined,
      9_500
    );

    expect(timeline[0]).toMatchObject({
      status: 'running',
      durationMs: 8_500,
    });
  });

  it('should expose failure details for tool cards', () => {
    const timeline = buildAgentTimeline([
      {
        id: 'tool-edit-1',
        kind: 'tool',
        description: 'edit_file src/ui/App.tsx',
        status: 'failed',
        details: 'Tool requires user approval',
      } as TaskItem,
    ]);

    expect(timeline[0]).toMatchObject({
      kind: 'tool',
      status: 'failed',
      detail: 'Tool requires user approval',
    });
  });

  it('should keep nested tool operations classified as tools', () => {
    const timeline = buildAgentTimeline([
      createTask(
        'agent-run-1:model:1:tool:1:list_files',
        'Listing files completed',
        'tool',
        'completed'
      ),
    ]);

    expect(timeline[0].kind).toBe('tool');
  });

  it('should group adjacent completed exploration tool activity', () => {
    const timeline = buildGroupedAgentTimeline(
      [
        createTimedTask('tool-read-1', 'read(package.json)', 'tool', 'completed', 1_000, 1_050),
        createTimedTask('tool-list-1', 'list(src)', 'tool', 'completed', 1_100, 1_250),
        createTimedTask(
          'tool-grep-1',
          'grep("UserIcon" in src)',
          'tool',
          'completed',
          1_300,
          1_600
        ),
        createTimedTask('tool-edit-1', 'edit(src/App.tsx)', 'tool', 'running', 1_700),
      ],
      undefined,
      3_000
    );

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({
      kind: 'explore',
      title: 'Explore completed',
      status: 'completed',
      groupedCount: 3,
      durationMs: 600,
    });
    expect(timeline[1]).toMatchObject({
      kind: 'tool',
      title: 'edit(src/App.tsx)',
      status: 'running',
      durationMs: 1_300,
    });
  });

  it('should not group failed tool activity', () => {
    const timeline = buildGroupedAgentTimeline([
      createTimedTask('tool-read-1', 'read(package.json)', 'tool', 'completed', 1_000, 1_050),
      createTimedTask('tool-edit-1', 'edit(src/App.tsx)', 'tool', 'failed', 1_100, 1_500),
    ]);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ kind: 'explore', groupedCount: 1 });
    expect(timeline[1]).toMatchObject({ kind: 'tool', status: 'failed' });
  });

  it('should group completed patch activity into the edit phase', () => {
    const timeline = buildGroupedAgentTimeline([
      createTimedTask('tool-patch-1', 'patch(workspace files)', 'tool', 'completed', 1_000, 1_500),
    ]);

    expect(timeline[0]).toMatchObject({
      kind: 'edit',
      title: 'Editing completed',
      groupedCount: 1,
      durationMs: 500,
    });
  });
});

function createTask(
  id: string,
  description: string,
  kind: TaskItem['kind'],
  status: TaskItem['status']
): TaskItem {
  return { id, kind, description, status } as TaskItem;
}

function createTimedTask(
  id: string,
  description: string,
  kind: TaskItem['kind'],
  status: TaskItem['status'],
  startTime: number,
  endTime?: number
): TaskItem {
  return { id, kind, description, status, startTime, ...(endTime ? { endTime } : {}) } as TaskItem;
}
