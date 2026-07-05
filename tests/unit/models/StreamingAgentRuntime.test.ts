import { stepCountIs, streamText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRuntimeEvent } from '../../../src/agents/AgentRuntimeEvent';
import { StreamingAgentRuntime } from '../../../src/models/StreamingAgentRuntime';
import type { ProviderModelDescriptor } from '../../../src/models/ModelProviderFactory';

const { stepCountIsMock, streamTextMock } = vi.hoisted(() => ({
  stepCountIsMock: vi.fn((count: number) => ({ count })),
  streamTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  stepCountIs: stepCountIsMock,
  streamText: streamTextMock,
}));

const descriptor = {
  providerId: 'deepseek',
  modelId: 'deepseek-reasoner',
  model: { specificationVersion: 'v3' },
  capabilities: { reasoning: true, tools: true },
} as unknown as ProviderModelDescriptor;

const usage = {
  inputTokens: 3,
  outputTokens: 5,
  totalTokens: 8,
};

describe('StreamingAgentRuntime', () => {
  let runtime: StreamingAgentRuntime;
  let stepCountIsTypedMock: ReturnType<typeof vi.mocked<typeof stepCountIs>>;
  let streamTextTypedMock: ReturnType<typeof vi.mocked<typeof streamText>>;

  beforeEach(() => {
    runtime = new StreamingAgentRuntime();
    stepCountIsTypedMock = vi.mocked(stepCountIs);
    streamTextTypedMock = vi.mocked(streamText);

    vi.clearAllMocks();
  });

  it('normalizes reasoning, tool and text stream parts in order', async () => {
    streamTextTypedMock.mockReturnValue({
      fullStream: asyncParts([
        { type: 'reasoning-start', id: 'reasoning-1' },
        { type: 'reasoning-delta', id: 'reasoning-1', text: 'Inspect files' },
        { type: 'reasoning-end', id: 'reasoning-1' },
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'list_files', input: {} },
        {
          type: 'tool-input-delta',
          toolCallId: 'call-1',
          toolName: 'list_files',
          inputTextDelta: '{"path":"src"}',
        },
        { type: 'tool-result', toolCallId: 'call-1', toolName: 'list_files', output: ['src'] },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: 'Done' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish-step', finishReason: 'stop', usage },
        { type: 'finish', finishReason: 'stop', totalUsage: usage },
      ]),
      text: Promise.resolve('Done'),
      totalUsage: Promise.resolve(usage),
    } as any);
    const events: AgentRuntimeEvent[] = [];

    const result = await runtime.execute(createInput(events));

    expect(stepCountIsTypedMock).toHaveBeenCalledWith(10);
    expect(streamTextTypedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: descriptor.model,
        system: 'system',
        prompt: 'add a menu',
        tools: {},
        stopWhen: { count: 10 },
      })
    );
    expect(events.map((event) => event.type)).toEqual([
      'model_started',
      'reasoning_started',
      'reasoning_delta',
      'reasoning_completed',
      'tool_started',
      'tool_input_delta',
      'tool_completed',
      'text_started',
      'text_delta',
      'text_completed',
      'step_completed',
      'model_completed',
    ]);
    const toolInputDeltaEvent = events.find((event) => event.type === 'tool_input_delta');
    expect(toolInputDeltaEvent).toBeDefined();
    if (toolInputDeltaEvent?.type === 'tool_input_delta') {
      const delta: string = toolInputDeltaEvent.delta;
      expect(delta).toBe('{"path":"src"}');
    }
    expect(result).toEqual({
      text: 'Done',
      usage: {
        promptTokens: 3,
        completionTokens: 5,
        totalTokens: 8,
      },
    });
  });

  it('fails the model operation when the provider stream throws', async () => {
    streamTextTypedMock.mockReturnValue({
      fullStream: throwingParts(new Error('provider disconnected')),
      text: Promise.resolve(''),
      totalUsage: Promise.resolve(undefined),
    } as any);
    const events: AgentRuntimeEvent[] = [];

    await expect(runtime.execute(createInput(events))).rejects.toThrow('provider disconnected');

    expect(events.at(-1)).toMatchObject({
      type: 'model_failed',
      lifecycle: 'failed',
      error: 'provider disconnected',
    });
  });

  it('emits run cancellation when the provider stream aborts', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const abortController = new AbortController();

    streamTextTypedMock.mockReturnValue({
      fullStream: asyncParts([{ type: 'reasoning-start', id: 'reasoning-1' }, abortError]),
      text: Promise.resolve(''),
      totalUsage: Promise.resolve(undefined),
    } as any);
    const events: AgentRuntimeEvent[] = [];

    await expect(
      runtime.execute(
        createInput(events, {
          abortSignal: abortController.signal,
        })
      )
    ).rejects.toThrow('The operation was aborted.');

    expect(events.map((event) => event.type)).toEqual([
      'model_started',
      'reasoning_started',
      'reasoning_completed',
      'model_failed',
      'run_cancelled',
    ]);
  });
});

function createInput(
  events: AgentRuntimeEvent[],
  overrides: Partial<Parameters<StreamingAgentRuntime['execute']>[0]> = {}
) {
  return {
    runId: 'run-1',
    descriptor,
    system: 'system',
    prompt: 'add a menu',
    tools: {},
    onEvent: (event: AgentRuntimeEvent) => events.push(event),
    ...overrides,
  };
}

async function* asyncParts(parts: unknown[]) {
  for (const part of parts) {
    if (part instanceof Error) {
      throw part;
    }

    yield part;
  }
}

async function* throwingParts(error: Error) {
  throw error;
}
