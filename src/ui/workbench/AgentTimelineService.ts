import type { TaskItem } from '../components/TaskTracker';

export type AgentTimelineKind =
  | 'intent'
  | 'plan'
  | 'model'
  | 'explore'
  | 'edit'
  | 'tool'
  | 'verification'
  | 'repair'
  | 'result';

export interface AgentTimelineItem {
  id: string;
  kind: AgentTimelineKind;
  status: TaskItem['status'];
  title: string;
  detail?: string;
  durationMs?: number;
  startedAt?: number;
  completedAt?: number;
  current: boolean;
  sequence: number;
  groupedCount?: number;
  children?: AgentTimelineItem[];
}

/**
 * Converts raw task events into a stable workbench timeline.
 *
 * App continues to own TaskItem state. This adapter adds presentation-level
 * categories and duration metadata so timeline components do not need to infer
 * orchestration semantics while rendering.
 */
export function buildAgentTimeline(
  tasks: TaskItem[],
  currentTask?: string,
  nowMs = Date.now()
): AgentTimelineItem[] {
  // Keep the event order supplied by App so the sequence matches what the user
  // saw happen. Rendering concerns such as colors stay outside this adapter.
  return tasks.map((task, index) => ({
    id: task.id,
    kind: task.kind,
    status: task.status,
    title: task.description,
    detail: task.details,
    durationMs: taskDuration(task, nowMs),
    startedAt: task.startTime,
    completedAt: task.endTime,
    current: task.status === 'running' || task.description === currentTask,
    sequence: index + 1,
  }));
}

/**
 * Builds the user-facing timeline for live terminal rendering.
 *
 * Raw tool traces stay in App state. This adapter only folds completed low-level
 * bursts so the terminal shows phases instead of a wall of read/list/grep rows.
 */
export function buildGroupedAgentTimeline(
  tasks: TaskItem[],
  currentTask?: string,
  nowMs = Date.now()
): AgentTimelineItem[] {
  const flatTimeline = buildAgentTimeline(tasks, currentTask, nowMs);
  const grouped: AgentTimelineItem[] = [];
  let pendingGroup: AgentTimelineItem[] = [];
  let pendingKind: AgentTimelineKind | undefined;

  for (const item of flatTimeline) {
    const groupKind = groupKindFor(item);
    if (!groupKind) {
      flushGroup(grouped, pendingGroup, pendingKind);
      pendingGroup = [];
      pendingKind = undefined;
      grouped.push(item);
      continue;
    }

    if (pendingKind && pendingKind !== groupKind) {
      flushGroup(grouped, pendingGroup, pendingKind);
      pendingGroup = [];
    }

    pendingKind = groupKind;
    pendingGroup.push(item);
  }

  flushGroup(grouped, pendingGroup, pendingKind);

  return grouped.map((item, index) => ({ ...item, sequence: index + 1 }));
}

function taskDuration(task: TaskItem, nowMs: number): number | undefined {
  if (task.startTime === undefined) {
    return undefined;
  }

  if (task.endTime !== undefined) {
    return Math.max(0, task.endTime - task.startTime);
  }

  if (task.status === 'running') {
    return Math.max(0, nowMs - task.startTime);
  }

  return undefined;
}

function flushGroup(
  grouped: AgentTimelineItem[],
  pendingGroup: AgentTimelineItem[],
  groupKind: AgentTimelineKind | undefined
): void {
  if (pendingGroup.length === 0 || !groupKind) {
    return;
  }

  const first = pendingGroup[0];
  const last = pendingGroup[pendingGroup.length - 1];
  const durationMs = groupDuration(pendingGroup);
  grouped.push({
    id: `${first.id}:group:${last.id}`,
    kind: groupKind,
    status: groupStatus(pendingGroup),
    title: groupTitle(groupKind),
    durationMs,
    current: pendingGroup.some((item) => item.current),
    sequence: first.sequence,
    groupedCount: pendingGroup.length,
    children: pendingGroup,
    startedAt: first.startedAt,
    completedAt: last.completedAt,
    ...(pendingGroup.length === 1 ? { detail: first.title } : {}),
  });
}

function groupKindFor(item: AgentTimelineItem): AgentTimelineKind | undefined {
  if (item.status !== 'completed') {
    return undefined;
  }

  if (item.kind === 'verification') {
    return 'verification';
  }

  if (item.kind !== 'tool') {
    return undefined;
  }

  if (/^(read|list|grep|glob)\(/.test(item.title)) {
    return 'explore';
  }

  if (/^(write|edit|edit_code|patch)\(/.test(item.title)) {
    return 'edit';
  }

  return undefined;
}

function groupTitle(kind: AgentTimelineKind): string {
  switch (kind) {
    case 'explore':
      return 'Explore completed';
    case 'edit':
      return 'Editing completed';
    case 'verification':
      return 'Verify completed';
    default:
      return 'Activity completed';
  }
}

function groupStatus(items: AgentTimelineItem[]): TaskItem['status'] {
  if (items.some((item) => item.status === 'failed')) {
    return 'failed';
  }
  if (items.some((item) => item.status === 'running')) {
    return 'running';
  }
  return 'completed';
}

function groupDuration(items: AgentTimelineItem[]): number | undefined {
  const startedAt = items
    .map((item) => item.startedAt)
    .filter((value): value is number => value !== undefined);
  const completedAt = items
    .map((item) => item.completedAt)
    .filter((value): value is number => value !== undefined);

  if (startedAt.length === 0 || completedAt.length === 0) {
    return undefined;
  }

  return Math.max(0, Math.max(...completedAt) - Math.min(...startedAt));
}
