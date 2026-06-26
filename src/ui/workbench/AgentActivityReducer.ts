import type { AgentLoopEvent } from '../../agents/AgentLoop';
import type { TaskItem } from '../components/TaskTracker';
import type { AgentTimelineKind } from './AgentTimelineService';

export interface AgentActivityState {
  runId?: string;
  phase: 'idle' | 'running' | 'failed';
  activities: TaskItem[];
}

export function createAgentActivityState(): AgentActivityState {
  return { phase: 'idle', activities: [] };
}

export function reduceAgentActivity(
  state: AgentActivityState,
  event: AgentLoopEvent
): AgentActivityState {
  const startsNewRun = state.runId !== event.runId;
  const base = startsNewRun
    ? { runId: event.runId, phase: 'running' as const, activities: [] }
    : state;

  if (isTerminalEvent(event)) {
    return finalizeRun(base, event);
  }

  const kind = event.runtimeKind
    ? runtimeKindToActivityKind(event.runtimeKind)
    : phaseToActivityKind(event.phase);
  if (!kind) {
    return base;
  }

  const id = event.operationId ?? `${event.runId}:${event.phase}`;
  const phaseClosedActivities = event.operationId
    ? base.activities
    : closePreviousPhase(base.activities, event.runId, id, event.timestamp);
  const existingIndex = phaseClosedActivities.findIndex((activity) => activity.id === id);
  const status: TaskItem['status'] =
    event.lifecycle === 'completed'
      ? 'completed'
      : event.lifecycle === 'failed' || event.phase === 'failed'
        ? 'failed'
        : event.lifecycle === 'started' || isActivePhase(event.phase)
          ? 'running'
          : 'completed';
  const previous = existingIndex >= 0 ? base.activities[existingIndex] : undefined;
  const activity: TaskItem = {
    id,
    kind,
    description: event.description,
    status,
    startTime: previous?.startTime ?? event.timestamp,
    ...(status === 'completed' || status === 'failed' ? { endTime: event.timestamp } : {}),
    ...(event.error ? { details: event.error } : {}),
  };
  const activities = [...phaseClosedActivities];
  if (existingIndex >= 0) activities[existingIndex] = activity;
  else activities.push(activity);

  return { ...base, phase: status === 'failed' ? 'failed' : 'running', activities };
}

export function selectLiveActivities(state: AgentActivityState): TaskItem[] {
  if (state.phase === 'idle') {
    return [];
  }

  const current = state.activities.filter(
    (item) => item.status === 'running' || item.status === 'failed'
  );
  if (current.length > 0) {
    const completed = state.activities.filter((item) => item.status === 'completed').slice(-2);
    return [...completed, current[current.length - 1]].slice(-3);
  }

  return state.activities.filter((item) => item.status !== 'pending').slice(-3);
}

function closePreviousPhase(
  activities: TaskItem[],
  runId: string,
  nextId: string,
  timestamp: number
): TaskItem[] {
  const phasePrefix = `${runId}:`;

  return activities.map((activity) =>
    activity.id !== nextId &&
    activity.id.startsWith(phasePrefix) &&
    !activity.id.includes(':tool:') &&
    activity.status === 'running'
      ? { ...activity, status: 'completed' as const, endTime: timestamp }
      : activity
  );
}

function isActivePhase(phase: AgentLoopEvent['phase']): boolean {
  return !['completed', 'incomplete', 'failed'].includes(phase);
}

function isTerminalEvent(event: AgentLoopEvent): boolean {
  return (
    event.phase === 'completed' ||
    event.phase === 'incomplete' ||
    (event.phase === 'failed' && !event.operationId) ||
    (event.runtimeKind === 'run' && event.lifecycle === 'cancelled')
  );
}

function finalizeRun(state: AgentActivityState, event: AgentLoopEvent): AgentActivityState {
  const terminalStatus: TaskItem['status'] = event.phase === 'completed' ? 'completed' : 'failed';
  const activities = state.activities.map((activity) =>
    activity.status === 'running'
      ? {
          ...activity,
          status: terminalStatus,
          endTime: event.timestamp,
          ...(event.error && terminalStatus === 'failed' && !activity.details
            ? { details: event.error }
            : {}),
        }
      : activity
  );
  const resultActivity = terminalActivity(event);

  if (resultActivity) {
    const existingIndex = activities.findIndex((activity) => activity.id === resultActivity.id);
    if (existingIndex >= 0) {
      activities[existingIndex] = resultActivity;
    } else {
      activities.push(resultActivity);
    }
  }

  return {
    ...state,
    phase: event.phase === 'completed' ? 'idle' : 'failed',
    activities,
  };
}

function terminalActivity(event: AgentLoopEvent): TaskItem | undefined {
  if (event.runtimeKind === 'run' && event.lifecycle === 'cancelled') {
    return {
      id: `${event.runId}:cancelled`,
      kind: 'result',
      description: event.description,
      status: 'failed',
      startTime: event.timestamp,
      endTime: event.timestamp,
      ...(event.error ? { details: event.error } : {}),
    };
  }

  if (event.phase === 'completed' || event.phase === 'incomplete' || event.phase === 'failed') {
    return {
      id: `${event.runId}:${event.phase}`,
      kind: 'result',
      description: event.description,
      status: event.phase === 'completed' ? 'completed' : 'failed',
      startTime: event.timestamp,
      endTime: event.timestamp,
      ...(event.error ? { details: event.error } : {}),
    };
  }

  return undefined;
}

function runtimeKindToActivityKind(
  runtimeKind: NonNullable<AgentLoopEvent['runtimeKind']>
): AgentTimelineKind | undefined {
  switch (runtimeKind) {
    case 'tool':
      return 'tool';
    case 'step':
      return 'tool';
    case 'model':
    case 'reasoning':
    case 'text':
    case 'run':
      return undefined;
  }
}

function phaseToActivityKind(phase: AgentLoopEvent['phase']): AgentTimelineKind {
  if (phase === 'intent') return 'intent';
  if (phase === 'planning') return 'plan';
  if (phase === 'verifying') return 'verification';
  if (phase === 'repairing') return 'repair';
  if (phase === 'completed' || phase === 'incomplete') return 'result';
  return 'tool';
}
