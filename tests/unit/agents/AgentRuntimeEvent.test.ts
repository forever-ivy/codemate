import { describe, expect, it } from 'vitest';
import {
  createAgentRuntimeEvent,
  type AgentRuntimeEvent,
  type AgentRuntimeEventType,
} from '../../../src/agents/AgentRuntimeEvent';

describe('AgentRuntimeEvent', () => {
  it('preserves explicit tool identity under a model turn', () => {
    const event = createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      stepId: 'step-1',
      operationId: 'tool-call-1',
      kind: 'tool',
      lifecycle: 'started',
      type: 'tool_started',
      toolName: 'list_files',
      toolCallId: 'call-1',
      description: 'Listing files',
    });

    expect(event.kind).toBe('tool');
    expect(event.operationId).toBe('tool-call-1');
    expect(event.turnId).toBe('turn-1');
    expect(typeof event.timestamp).toBe('number');
  });

  it('captures first-output and completion timing', () => {
    const event = createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'model-1',
      kind: 'model',
      lifecycle: 'completed',
      type: 'model_completed',
      description: 'Model completed',
      startedAt: 100,
      firstOutputAt: 250,
      completedAt: 900,
    });

    expect(event.providerWaitDurationMs).toBe(150);
    expect(event.durationMs).toBe(800);
  });

  it('narrows tool events by kind', () => {
    const describeEvent = (event: AgentRuntimeEvent): string => {
      if (event.kind === 'tool') {
        const toolName: string = event.toolName;
        const toolCallId: string | undefined = event.toolCallId;
        return `${toolName}:${toolCallId ?? 'none'}`;
      }

      return event.description;
    };

    const event = createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'tool-1',
      kind: 'tool',
      lifecycle: 'completed',
      type: 'tool_completed',
      description: 'Tool completed',
      toolName: 'list_files',
      toolCallId: 'call-1',
    });

    expect(describeEvent(event)).toBe('list_files:call-1');
  });

  it('narrows tool input delta events to a typed delta payload', () => {
    const readToolDelta = (event: AgentRuntimeEvent): string => {
      if (event.kind === 'tool' && event.type === 'tool_input_delta') {
        const delta: string = event.delta;
        return delta;
      }

      return event.description;
    };

    const event = createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'tool-1',
      kind: 'tool',
      lifecycle: 'delta',
      type: 'tool_input_delta',
      description: 'Tool input chunk',
      toolName: 'list_files',
      toolCallId: 'call-1',
      delta: '{"path":"src"}',
    });

    expect(readToolDelta(event)).toBe('{"path":"src"}');
  });

  it('rejects delta on non-delta tool variants', () => {
    createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'tool-1',
      kind: 'tool',
      lifecycle: 'started',
      type: 'tool_started',
      description: 'Tool started',
      toolName: 'list_files',
      toolCallId: 'call-1',
      // @ts-expect-error tool_started should not accept delta
      delta: 'unexpected',
    });

    expect(true).toBe(true);
  });

  it('narrows reasoning events by kind', () => {
    const readDelta = (event: AgentRuntimeEvent): string => {
      switch (event.kind) {
        case 'reasoning':
          const delta: string = event.delta;
          return delta;
        default:
          return event.description;
      }
    };

    const event = createAgentRuntimeEvent({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'reasoning-1',
      kind: 'reasoning',
      lifecycle: 'delta',
      type: 'reasoning_delta',
      description: 'Reasoning chunk',
      delta: 'thinking',
    });

    expect(readDelta(event)).toBe('thinking');
  });

  it('excludes legacy model_step_completed from public event types', () => {
    // @ts-expect-error legacy event name is no longer public
    const legacyType: AgentRuntimeEventType = 'model_step_completed';

    const currentType: AgentRuntimeEventType = 'step_completed';

    expect(currentType).toBe('step_completed');
    void legacyType;
  });
});
