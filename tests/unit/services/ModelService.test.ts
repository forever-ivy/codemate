import { Container } from '@/application/Container';
import type { ToolManager } from '@/managers/ToolManager';
import type { ProviderModelDescriptor } from '@/models/ModelProviderFactory';
import type { StreamingAgentRuntimeResult } from '@/models/StreamingAgentRuntime';
import { EventBus } from '@/services/EventBus';
import { ModelService } from '@/services/ModelService';
import { Paths } from '@/services/Paths';
import { Tool } from '@/tools/base/Tool';
import type { ModelConfig } from '@/types/index';
import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  tool: vi.fn((definition) => definition),
}));

class ReadFileTool extends Tool<{ path: string }, { path: string }> {
  name = 'read_file';
  description = 'Read file contents';
  schema = z.object({
    path: z.string(),
  });

  async execute(input: { path: string }): Promise<{ path: string }> {
    return input;
  }
}

const descriptor = {
  providerId: 'deepseek',
  modelId: 'deepseek-reasoner',
  model: { specificationVersion: 'v3' },
  capabilities: { reasoning: true, tools: true },
} as unknown as ProviderModelDescriptor;

const runtimeResult: StreamingAgentRuntimeResult = {
  text: 'done',
  usage: {
    promptTokens: 1,
    completionTokens: 2,
    totalTokens: 3,
  },
};

type ModelServicePrivateAccess = ModelService & {
  buildSystemPrompt(extraInstructions?: string): string;
  withSystemPrompt(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
};

describe('ModelService', () => {
  let modelService: ModelService;
  let config: ModelConfig;
  let container: Container;
  let paths: Paths;
  let generateTextMock: ReturnType<typeof vi.mocked<typeof generateText>>;
  let providerFactory: {
    create: ReturnType<typeof vi.fn>;
  };
  let streamingRuntime: {
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    generateTextMock = vi.mocked(generateText);
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue({
      text: 'done',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
      },
    } as never);

    container = new Container();
    paths = new Paths({ productName: 'aicli', cwd: process.cwd() });
    container.register('paths', paths);
    container.register('eventBus', new EventBus());

    config = {
      apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.7,
    };

    providerFactory = {
      create: vi.fn(() => descriptor),
    };
    streamingRuntime = {
      execute: vi.fn().mockResolvedValue(runtimeResult),
    };

    modelService = createService();
  });

  it('should initialize with config', () => {
    expect(modelService).toBeDefined();
    expect(modelService.getConfig()).toMatchObject(config);
  });

  it('should return config', () => {
    const returnedConfig = modelService.getConfig();
    expect(returnedConfig.apiKey).toBe(config.apiKey);
    expect(returnedConfig.model).toBe(config.model);
  });

  it('should build an identity prompt from the configured DeepSeek model', () => {
    const systemPrompt = (modelService as unknown as ModelServicePrivateAccess).buildSystemPrompt();

    expect(systemPrompt).toContain('CodeMate AI CLI');
    expect(systemPrompt).toContain('deepseek-chat');
    expect(systemPrompt).toContain('DeepSeek');
    expect(systemPrompt).toContain('不要声称自己是 Claude');
  });

  it('should include the coding agent completion contract in the system prompt', () => {
    const systemPrompt = (modelService as unknown as ModelServicePrivateAccess).buildSystemPrompt();

    expect(systemPrompt).toContain('Coding agent 工作契约');
    expect(systemPrompt).toContain('先探索相关文件');
    expect(systemPrompt).toContain('修改文件前必须先读取目标文件');
    expect(systemPrompt).toContain('修改后必须运行合适的验证');
    expect(systemPrompt).toContain('没有真实文件改动时，不要声称已完成开发任务');
    expect(systemPrompt).toContain('最终回答必须包含改动文件、验证结果');
  });

  it('should prepend identity instructions to existing system messages', () => {
    const messages = (modelService as unknown as ModelServicePrivateAccess).withSystemPrompt([
      { role: 'system', content: 'Use concise answers.' },
      { role: 'user', content: '你是什么模型？' },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('当前配置的模型 ID 是 "deepseek-chat"');
    expect(messages[0].content).toContain('Use concise answers.');
  });

  it.skipIf(!process.env.DEEPSEEK_API_KEY)(
    'should chat with AI',
    async () => {
      const response = await modelService.chat('Say "Hello" in one word');

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.model).toBeTruthy();
      expect(typeof response.content).toBe('string');
    },
    10000
  );

  it.skipIf(!process.env.DEEPSEEK_API_KEY)(
    'should chat with multiple messages',
    async () => {
      const response = await modelService.chatWithMessages([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hi" in one word' },
      ]);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    },
    10000
  );

  it('should handle API errors', async () => {
    const badConfig: ModelConfig = {
      apiKey: 'invalid-key',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    };

    const badService = createService(badConfig);
    generateTextMock.mockRejectedValueOnce(new Error('bad key'));

    await expect(badService.chat('test')).rejects.toThrow();
  }, 10000);

  it('skips the planning model call by default', async () => {
    await modelService.chatWithTools('add a menu', [], createToolManagerMock());

    expect(generateTextMock).not.toHaveBeenCalled();
    expect(streamingRuntime.execute).toHaveBeenCalledTimes(1);
  });

  it('delegates tool chat execution to StreamingAgentRuntime', async () => {
    const onRuntimeEvent = vi.fn();
    const abortController = new AbortController();

    const response = await modelService.chatWithTools('add a menu', [], createToolManagerMock(), {
      runId: 'run-1',
      abortSignal: abortController.signal,
      onRuntimeEvent,
    });

    expect(providerFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        model: config.model,
      })
    );
    expect(streamingRuntime.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        descriptor,
        prompt: 'add a menu',
        abortSignal: abortController.signal,
        onEvent: expect.any(Function),
      })
    );
    const runtimeInput = streamingRuntime.execute.mock.calls[0]?.[0];
    runtimeInput?.onEvent?.({
      runId: 'run-1',
      turnId: 'turn-1',
      operationId: 'text-1',
      kind: 'text',
      lifecycle: 'delta',
      type: 'text_delta',
      description: 'Responding',
      delta: 'hello',
      timestamp: 1,
    });
    expect(onRuntimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text_delta',
        delta: 'hello',
      })
    );
    expect(response).toEqual({
      content: 'done',
      model: 'deepseek-reasoner',
      usage: {
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
      },
    });
  });

  it('should pass the coding agent tool workflow contract to the streaming runtime', async () => {
    await modelService.chatWithTools('优化左侧导航菜单', [], createToolManagerMock(), {
      runId: 'run-1',
    });

    const runtimeInput = streamingRuntime.execute.mock.calls[0]?.[0];

    expect(runtimeInput?.system).toContain('当前工作目录');
    expect(runtimeInput?.system).toContain(
      '理解需求 -> 探索文件 -> 读取目标文件 -> 修改文件 -> 运行验证 -> 总结结果'
    );
    expect(runtimeInput?.system).toContain('优先用 grep、glob、list_files 定位入口和相关文件');
    expect(runtimeInput?.system).toContain('编辑现有文件前必须先调用 read_file');
    expect(runtimeInput?.system).toContain('开发任务完成前必须运行合适验证');
    expect(runtimeInput?.system).toContain('如果没有改动文件，必须说明 incomplete');
  });

  it('bridges runtime delta events into legacy stream events without duplicating runtime delivery', async () => {
    const onRuntimeEvent = vi.fn();
    const streamEvents: Array<{ kind: string; delta: string; runId: string }> = [];
    const runtimeEvents = [
      {
        runId: 'run-1',
        turnId: 'turn-1',
        stepId: 'step-1',
        operationId: 'reasoning-1',
        kind: 'reasoning',
        lifecycle: 'delta',
        type: 'reasoning_delta',
        description: 'Thinking',
        delta: 'Let me think',
        timestamp: 1,
      },
      {
        runId: 'run-1',
        turnId: 'turn-1',
        stepId: 'step-1',
        operationId: 'text-1',
        kind: 'text',
        lifecycle: 'delta',
        type: 'text_delta',
        description: 'Responding',
        delta: 'Hello',
        timestamp: 2,
      },
      {
        runId: 'run-1',
        turnId: 'turn-1',
        stepId: 'step-1',
        operationId: 'call-1',
        kind: 'tool',
        lifecycle: 'started',
        type: 'tool_started',
        description: 'Running read_file',
        toolName: 'read_file',
        toolCallId: 'call-1',
        timestamp: 3,
      },
      {
        runId: 'run-1',
        turnId: 'turn-1',
        stepId: 'step-1',
        operationId: 'call-1',
        kind: 'tool',
        lifecycle: 'delta',
        type: 'tool_input_delta',
        description: 'Preparing read_file',
        toolName: 'read_file',
        toolCallId: 'call-1',
        delta: '{"path":"src/App.tsx"}',
        timestamp: 4,
      },
      {
        runId: 'run-1',
        turnId: 'turn-1',
        operationId: 'run-1:model',
        kind: 'model',
        lifecycle: 'completed',
        type: 'model_completed',
        description: 'Model completed',
        timestamp: 5,
      },
    ] as const;

    streamingRuntime.execute.mockImplementationOnce(async (input) => {
      for (const event of runtimeEvents) {
        input.onEvent?.(event);
      }
      return runtimeResult;
    });

    await modelService.chatWithTools('add a menu', [], createToolManagerMock(), {
      runId: 'run-1',
      onRuntimeEvent,
      onStreamEvent: (event) =>
        streamEvents.push({ kind: event.kind, delta: event.delta, runId: event.runId }),
    });

    expect(onRuntimeEvent).toHaveBeenCalledTimes(runtimeEvents.length);
    expect(onRuntimeEvent.mock.calls.map(([event]) => event.type)).toEqual(
      runtimeEvents.map((event) => event.type)
    );
    expect(streamEvents).toEqual([
      { runId: 'run-1', kind: 'reasoning', delta: 'Let me think' },
      { runId: 'run-1', kind: 'text', delta: 'Hello' },
      { runId: 'run-1', kind: 'tool', delta: 'read_file' },
      { runId: 'run-1', kind: 'tool', delta: 'read_file' },
    ]);
  });

  it('builds AI SDK 6 tools and preserves tool manager execution behavior', async () => {
    const toolManager = {
      executeWithResult: vi.fn(async () => ({
        ok: true,
        toolName: 'read_file',
        input: { path: 'src/App.tsx' },
        output: { path: 'src/App.tsx' },
        durationMs: 12,
        executionDurationMs: 3,
        timestamp: Date.now(),
      })),
    };

    streamingRuntime.execute.mockImplementationOnce(async (input) => {
      const readFileTool = input.tools.read_file as {
        description: string;
        inputSchema: unknown;
        execute: (
          args: unknown,
          context: {
            toolCallId: string;
          }
        ) => Promise<unknown>;
      };

      expect(readFileTool.description).toBe('Read file contents');
      expect(readFileTool.inputSchema).toBeDefined();

      const output = await readFileTool.execute({ path: 'src/App.tsx' }, { toolCallId: 'call-1' });

      expect(output).toEqual({ path: 'src/App.tsx' });

      return runtimeResult;
    });

    await modelService.chatWithTools(
      'read src/App.tsx',
      [new ReadFileTool()],
      toolManager as unknown as ToolManager,
      {
        runId: 'run-1',
      }
    );

    expect(toolManager.executeWithResult).toHaveBeenCalledWith(
      'read_file',
      { path: 'src/App.tsx' },
      { toolCallId: 'call-1' }
    );
  });

  it('surfaces failed tool execution through the delegated runtime path', async () => {
    const toolManager = {
      executeWithResult: vi.fn(async () => ({
        ok: false,
        toolName: 'read_file',
        input: { path: 'missing.ts' },
        error: new Error('File not found'),
        durationMs: 7,
        executionDurationMs: 2,
        timestamp: Date.now(),
      })),
    };

    streamingRuntime.execute.mockImplementationOnce(async (input) => {
      const readFileTool = input.tools.read_file as {
        execute: (
          args: unknown,
          context: {
            toolCallId: string;
          }
        ) => Promise<unknown>;
      };

      await readFileTool.execute({ path: 'missing.ts' }, { toolCallId: 'call-1' });

      return runtimeResult;
    });

    await expect(
      modelService.chatWithTools(
        'read missing.ts',
        [new ReadFileTool()],
        toolManager as unknown as ToolManager,
        { runId: 'run-1' }
      )
    ).rejects.toThrow('AI API failed: File not found');
  });

  function createService(
    overrideConfig: ModelConfig = config,
    deps?: {
      providerFactory?: typeof providerFactory;
      streamingRuntime?: typeof streamingRuntime;
    }
  ) {
    const ModelServiceConstructor = ModelService as unknown as new (
      config: ModelConfig & { container: Container; paths: Paths },
      deps?: unknown
    ) => ModelService;

    return new ModelServiceConstructor(
      {
        ...overrideConfig,
        container,
        paths,
      },
      {
        providerFactory,
        streamingRuntime,
        ...deps,
      }
    );
  }

  function createToolManagerMock() {
    return {
      executeWithResult: vi.fn(),
    } as unknown as ToolManager;
  }
});
