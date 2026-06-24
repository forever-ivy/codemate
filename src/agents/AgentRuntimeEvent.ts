export type AgentRuntimeEventKind = 'model' | 'reasoning' | 'text' | 'tool' | 'step' | 'run';

export type AgentRuntimeLifecycle = 'started' | 'delta' | 'completed' | 'failed' | 'cancelled';

export type AgentRuntimeEventType =
  | 'model_started'
  | 'model_completed'
  | 'model_failed'
  | 'reasoning_started'
  | 'reasoning_delta'
  | 'reasoning_completed'
  | 'text_started'
  | 'text_delta'
  | 'text_completed'
  | 'tool_started'
  | 'tool_input_delta'
  | 'tool_completed'
  | 'tool_failed'
  | 'step_completed'
  | 'run_cancelled';

interface AgentRuntimeEventBase<
  TKind extends AgentRuntimeEventKind,
  TType extends AgentRuntimeEventType,
  TLifecycle extends AgentRuntimeLifecycle,
> {
  runId: string;
  turnId: string;
  stepId?: string;
  operationId: string;
  kind: TKind;
  lifecycle: TLifecycle;
  type: TType;
  description: string;
  timestamp: number;
  startedAt?: number;
  firstOutputAt?: number;
  completedAt?: number;
  providerWaitDurationMs?: number;
  durationMs?: number;
  error?: string;
}

export interface AgentRuntimeModelEvent
  extends AgentRuntimeEventBase<
    'model',
    'model_started' | 'model_completed' | 'model_failed',
    AgentRuntimeLifecycle
  > {}

export interface AgentRuntimeReasoningEvent
  extends AgentRuntimeEventBase<
    'reasoning',
    'reasoning_started' | 'reasoning_delta' | 'reasoning_completed',
    AgentRuntimeLifecycle
  > {
  delta: string;
}

export interface AgentRuntimeTextEvent
  extends AgentRuntimeEventBase<
    'text',
    'text_started' | 'text_delta' | 'text_completed',
    AgentRuntimeLifecycle
  > {
  delta: string;
}

interface AgentRuntimeToolEventBase<
  TType extends 'tool_started' | 'tool_input_delta' | 'tool_completed' | 'tool_failed',
  TLifecycle extends AgentRuntimeLifecycle,
> extends AgentRuntimeEventBase<'tool', TType, TLifecycle> {
  toolName: string;
  toolCallId: string;
  toolInput?: unknown;
}

export interface AgentRuntimeToolStateEvent
  extends AgentRuntimeToolEventBase<
    'tool_started' | 'tool_completed' | 'tool_failed',
    'started' | 'completed' | 'failed'
  > {}

export interface AgentRuntimeToolDeltaEvent
  extends AgentRuntimeToolEventBase<'tool_input_delta', 'delta'> {
  delta: string;
}

export type AgentRuntimeToolEvent = AgentRuntimeToolStateEvent | AgentRuntimeToolDeltaEvent;

export interface AgentRuntimeStepEvent
  extends AgentRuntimeEventBase<'step', 'step_completed', 'completed'> {}

export interface AgentRuntimeRunEvent
  extends AgentRuntimeEventBase<'run', 'run_cancelled', 'cancelled'> {}

export type AgentRuntimeEvent =
  | AgentRuntimeModelEvent
  | AgentRuntimeReasoningEvent
  | AgentRuntimeTextEvent
  | AgentRuntimeToolEvent
  | AgentRuntimeStepEvent
  | AgentRuntimeRunEvent;

type CreateAgentRuntimeEventInputFor<TEvent extends AgentRuntimeEvent> = Omit<
  TEvent,
  'timestamp' | 'durationMs' | 'providerWaitDurationMs'
> & {
  timestamp?: number;
  durationMs?: number;
  providerWaitDurationMs?: number;
};

export type CreateAgentRuntimeEventInput =
  | CreateAgentRuntimeEventInputFor<AgentRuntimeModelEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeReasoningEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeTextEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeToolStateEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeToolDeltaEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeStepEvent>
  | CreateAgentRuntimeEventInputFor<AgentRuntimeRunEvent>;

type AgentRuntimeEventForInput<TInput extends CreateAgentRuntimeEventInput> =
  TInput extends CreateAgentRuntimeEventInputFor<infer TEvent extends AgentRuntimeEvent>
    ? TEvent
    : never;

export function createAgentRuntimeEvent<TInput extends CreateAgentRuntimeEventInput>(
  input: TInput
): AgentRuntimeEventForInput<TInput> {
  return {
    ...input,
    timestamp: input.timestamp ?? Date.now(),
    durationMs:
      input.durationMs ??
      (input.startedAt !== undefined && input.completedAt !== undefined
        ? Math.max(0, input.completedAt - input.startedAt)
        : undefined),
    providerWaitDurationMs:
      input.providerWaitDurationMs ??
      (input.startedAt !== undefined && input.firstOutputAt !== undefined
        ? Math.max(0, input.firstOutputAt - input.startedAt)
        : undefined),
  } as unknown as AgentRuntimeEventForInput<TInput>;
}
