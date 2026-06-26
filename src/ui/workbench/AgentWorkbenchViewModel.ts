import type { EnhancedMessage } from '../../types/index';
import type { TaskItem } from '../components/TaskTracker';

export type AgentWorkbenchStatus = 'idle' | 'thinking' | 'streaming' | 'error';
export type AgentWorkbenchPhase = 'idle' | 'thinking' | 'acting' | 'blocked';

export interface AgentWorkbenchInput {
  messages: Pick<EnhancedMessage, 'role' | 'content'>[];
  tasks: TaskItem[];
  currentTask?: string;
  status: AgentWorkbenchStatus;
  isLoading: boolean;
  sessionId?: string;
  model: string;
  project: string;
}

export interface AgentWorkbenchMessageStats {
  user: number;
  assistant: number;
  tool: number;
}

export interface AgentWorkbenchTaskStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface AgentWorkbenchViewModel {
  phase: AgentWorkbenchPhase;
  phaseLabel: string;
  activitySummary: string;
  hint: string;
  currentTask?: string;
  model: string;
  project: string;
  sessionId?: string;
  messageStats: AgentWorkbenchMessageStats;
  taskStats: AgentWorkbenchTaskStats;
}

/**
 * Builds a stable terminal workbench model from raw UI state.
 *
 * 调用链路：
 * AppContent -> buildAgentWorkbenchViewModel -> AgentWorkbench
 *
 * The model keeps phase, counters and hints in one tested place so Ink
 * components can focus on rendering instead of re-deriving agent state.
 */
export function buildAgentWorkbenchViewModel(input: AgentWorkbenchInput): AgentWorkbenchViewModel {
  const taskStats = countTasks(input.tasks);
  const messageStats = countMessages(input.messages);
  const phase = resolvePhase(input, taskStats);

  return {
    phase,
    phaseLabel: phaseLabel(phase),
    activitySummary: activitySummary(input.messages.length, taskStats, input.currentTask),
    hint: phaseHint(phase),
    currentTask: input.currentTask || undefined,
    model: input.model,
    project: input.project,
    sessionId: input.sessionId,
    messageStats,
    taskStats,
  };
}

function resolvePhase(
  input: AgentWorkbenchInput,
  taskStats: AgentWorkbenchTaskStats
): AgentWorkbenchPhase {
  if (input.status === 'error' || taskStats.failed > 0) {
    return 'blocked';
  }

  if (taskStats.running > 0 || input.currentTask) {
    return 'acting';
  }

  if (input.isLoading || input.status === 'thinking' || input.status === 'streaming') {
    return 'thinking';
  }

  return 'idle';
}

function countMessages(
  messages: Pick<EnhancedMessage, 'role' | 'content'>[]
): AgentWorkbenchMessageStats {
  return messages.reduce<AgentWorkbenchMessageStats>(
    (stats, message) => {
      if (message.role === 'user') {
        stats.user += 1;
      } else if (message.role === 'assistant') {
        stats.assistant += 1;
        stats.tool += countToolParts(message.content);
      }

      return stats;
    },
    { user: 0, assistant: 0, tool: 0 }
  );
}

function countToolParts(content: EnhancedMessage['content']): number {
  if (!Array.isArray(content)) {
    return 0;
  }

  return content.filter((part) => part.type === 'tool_use' || part.type === 'tool_result').length;
}

function countTasks(tasks: TaskItem[]): AgentWorkbenchTaskStats {
  return tasks.reduce<AgentWorkbenchTaskStats>(
    (stats, task) => {
      stats[task.status] += 1;
      return stats;
    },
    { pending: 0, running: 0, completed: 0, failed: 0 }
  );
}

function phaseLabel(phase: AgentWorkbenchPhase): string {
  switch (phase) {
    case 'thinking':
      return 'Thinking';
    case 'acting':
      return 'Acting';
    case 'blocked':
      return 'Needs attention';
    default:
      return 'Ready';
  }
}

function phaseHint(phase: AgentWorkbenchPhase): string {
  switch (phase) {
    case 'thinking':
      return 'The model is planning the next step.';
    case 'acting':
      return 'Tools or verification are running. Watch the activity panel.';
    case 'blocked':
      return 'Review the failed step, approve a tool, or ask the agent to retry.';
    default:
      return 'Type a request or "/" for commands.';
  }
}

function activitySummary(
  messageCount: number,
  taskStats: AgentWorkbenchTaskStats,
  currentTask?: string
): string {
  const taskParts = [
    formatCount(taskStats.running, 'running'),
    formatCount(taskStats.pending, 'pending'),
    formatCount(taskStats.completed, 'completed'),
    formatCount(taskStats.failed, 'failed'),
  ].filter(Boolean);

  const taskSummary =
    taskParts.length > 0 ? taskParts.join(' · ') : currentTask ? '1 active task' : 'no active task';
  return `${messageCount} ${messageCount === 1 ? 'message' : 'messages'} · ${taskSummary}`;
}

function formatCount(count: number, label: string): string | undefined {
  return count > 0 ? `${count} ${label}` : undefined;
}
