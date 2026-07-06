import { describe, expect, it } from 'vitest';
import {
  createAgentActivityState,
  reduceAgentActivity,
  selectLiveActivities,
} from '../../../src/ui/workbench/AgentActivityReducer';

describe('AgentActivityReducer', () => {
  it('uses runtimeKind instead of operation-id text', () => {
    const state = reduceAgentActivity(createAgentActivityState(), {
      runId: 'run-1',
      phase: 'executing',
      runtimeKind: 'tool',
      operationId: 'run-1:model:1:tool:1:list_files',
      lifecycle: 'completed',
      description: 'Listing files completed',
      timestamp: 10,
    });

    expect(state.activities[0]).toMatchObject({
      id: 'run-1:model:1:tool:1:list_files',
      kind: 'tool',
      status: 'completed',
    });
  });

  it('updates one operation from running to completed', () => {
    let state = createAgentActivityState();
    state = reduceAgentActivity(state, {
      runId: 'run-1',
      operationId: 'run-1:tool:1:read_file',
      lifecycle: 'started',
      phase: 'executing',
      description: 'Reading file: src/App.tsx',
      timestamp: 10,
    });
    state = reduceAgentActivity(state, {
      runId: 'run-1',
      operationId: 'run-1:tool:1:read_file',
      lifecycle: 'completed',
      phase: 'executing',
      description: 'Reading file completed',
      timestamp: 20,
    });

    expect(state.activities).toHaveLength(1);
    expect(state.activities[0]).toMatchObject({
      id: 'run-1:tool:1:read_file',
      kind: 'tool',
      status: 'completed',
      description: 'Reading file completed',
      startTime: 10,
      endTime: 20,
    });
  });

  it('closes every running activity and keeps bounded history when the run completes', () => {
    let state = createAgentActivityState();
    state = reduceAgentActivity(state, {
      runId: 'run-1',
      operationId: 'run-1:tool:1:read_file',
      runtimeKind: 'tool',
      lifecycle: 'started',
      phase: 'executing',
      description: 'Reading file: src/App.tsx',
      timestamp: 10,
    });
    state = reduceAgentActivity(state, {
      runId: 'run-1',
      operationId: 'run-1:step:1',
      runtimeKind: 'step',
      lifecycle: 'completed',
      phase: 'executing',
      description: 'Step completed: tool-result',
      timestamp: 20,
    });

    const completed = reduceAgentActivity(state, {
      runId: 'run-1',
      phase: 'completed',
      description: 'Agent run completed',
      timestamp: 100,
    });

    expect(completed.phase).toBe('idle');
    expect(completed.activities).toHaveLength(3);
    expect(completed.activities.some((item) => item.status === 'running')).toBe(false);
    expect(completed.activities).toEqual([
      expect.objectContaining({
        id: 'run-1:tool:1:read_file',
        kind: 'tool',
        status: 'completed',
        endTime: 100,
      }),
      expect.objectContaining({
        id: 'run-1:step:1',
        kind: 'tool',
        status: 'completed',
        endTime: 20,
      }),
      expect.objectContaining({
        id: 'run-1:completed',
        kind: 'result',
        status: 'completed',
        description: 'Agent run completed',
        endTime: 100,
      }),
    ]);
  });

  it('keeps duplicate completed events idempotent', () => {
    const completed = {
      runId: 'run-1',
      operationId: 'op-1',
      runtimeKind: 'tool' as const,
      lifecycle: 'completed' as const,
      phase: 'executing' as const,
      description: 'Reading file completed',
      timestamp: 20,
    };
    const once = reduceAgentActivity(createAgentActivityState(), completed);
    const twice = reduceAgentActivity(once, completed);

    expect(twice.activities).toEqual(once.activities);
  });

  it('returns the current activity and two recent completed activities', () => {
    const state = {
      runId: 'run-1',
      phase: 'running' as const,
      activities: [
        {
          id: '1',
          kind: 'tool' as const,
          description: 'one',
          status: 'completed' as const,
          startTime: 1,
          endTime: 2,
        },
        {
          id: '2',
          kind: 'tool' as const,
          description: 'two',
          status: 'completed' as const,
          startTime: 3,
          endTime: 4,
        },
        {
          id: '3',
          kind: 'tool' as const,
          description: 'three',
          status: 'completed' as const,
          startTime: 5,
          endTime: 6,
        },
        {
          id: '4',
          kind: 'tool' as const,
          description: 'current',
          status: 'running' as const,
          startTime: 7,
        },
      ],
    };

    expect(selectLiveActivities(state).map((item) => item.id)).toEqual(['2', '3', '4']);
  });

  it('hides completed activities after a successful run returns to idle', () => {
    const state = {
      runId: 'run-1',
      phase: 'idle' as const,
      activities: [
        {
          id: '1',
          kind: 'result' as const,
          description: 'Agent run completed',
          status: 'completed' as const,
          startTime: 10,
          endTime: 10,
        },
      ],
    };

    expect(selectLiveActivities(state)).toEqual([]);
  });

  it('closes the previous orchestration phase when the next phase starts', () => {
    let state = reduceAgentActivity(createAgentActivityState(), {
      runId: 'run-1',
      phase: 'received',
      description: 'Received user request',
      timestamp: 1_000,
    });
    state = reduceAgentActivity(state, {
      runId: 'run-1',
      phase: 'intent',
      description: 'Classifying request intent',
      timestamp: 1_050,
    });

    expect(state.activities).toEqual([
      expect.objectContaining({
        id: 'run-1:received',
        status: 'completed',
        startTime: 1_000,
        endTime: 1_050,
      }),
      expect.objectContaining({
        id: 'run-1:intent',
        status: 'running',
        startTime: 1_050,
      }),
    ]);
  });
});
