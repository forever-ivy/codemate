import type { AgentLoopEvent } from '@/agents/AgentLoop';
import type { AgentLoop } from '@/agents/AgentLoop';
import { Application } from '@/application/Application';
import type { ToolManager } from '@/managers/ToolManager';
import type { EventBus } from '@/services/EventBus';
import type { ModelService } from '@/services/ModelService';
import type { SessionService } from '@/services/SessionService';
import type { ToolApprovalRequest } from '@/tools/ToolApprovalRequestService';
import type { ConfigService } from '@/services/ConfigService';
import type { EnhancedConfig, ModelConfig } from '@/types/index';
import { App } from '@/ui/App';
import { cleanup, render } from 'ink-testing-library';
import fs from 'node:fs';
import * as path from 'pathe';
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let latestTextInputProps:
  | {
      value: string;
      placeholder?: string;
      focus?: boolean;
      onChange?: (value: string) => void;
      onSubmit?: (value: string) => void;
    }
  | undefined;
let latestModelSelectorProps:
  | {
      currentModelId: string;
      onSelect: (modelId: string) => void;
      onClose: () => void;
    }
  | undefined;
let textInputMountCount = 0;
let textInputUnmountCount = 0;

vi.mock('ink-text-input', async () => {
  const ReactModule = await import('react');
  const { Text } = await import('ink');

  function MockTextInput(props: any) {
    ReactModule.useEffect(() => {
      textInputMountCount += 1;
      return () => {
        textInputUnmountCount += 1;
      };
    }, []);

    latestTextInputProps = props;
    return ReactModule.createElement(Text, null, props.value || props.placeholder || '');
  }

  return {
    default: MockTextInput,
  };
});

vi.mock('@/ui/components/ModelSelector.js', async () => {
  const ReactModule = await import('react');
  const { Box, Text } = await import('ink');

  function MockModelSelector(props: any) {
    latestModelSelectorProps = props;

    return ReactModule.createElement(
      Box,
      { flexDirection: 'column' },
      ReactModule.createElement(Text, null, 'Select Model'),
      ReactModule.createElement(Text, null, `Current model: ${props.currentModelId}`)
    );
  }

  return {
    ModelSelector: MockModelSelector,
  };
});

describe('App Component', () => {
  let app: Application;
  let configService: ConfigService;
  let sessionLogDir: string;

  beforeEach(() => {
    latestTextInputProps = undefined;
    latestModelSelectorProps = undefined;
    textInputMountCount = 0;
    textInputUnmountCount = 0;

    // 创建 Application（传入测试配置）
    const modelConfig: ModelConfig = {
      apiKey: 'test-key',
      baseURL: 'https://api.test.com',
      model: 'deepseek-chat',
      temperature: 0.7,
    };

    configService = {
      getConfig: vi.fn(
        (): EnhancedConfig => ({
          model: 'deepseek-chat',
          planModel: 'deepseek-chat',
          language: 'English',
          quiet: false,
          approvalMode: 'autoEdit',
          plugins: [],
          mcpServers: {},
          provider: {},
          todo: true,
          autoCompact: true,
          truncation: true,
          outputFormat: 'text',
          autoUpdate: true,
          extensions: {},
          tools: {},
          agent: {},
          checkpoints: true,
          workspace: {
            baseBranch: 'main',
            autoDelete: true,
            parentDir: '..',
          },
        })
      ),
      getModelConfig: vi.fn(() => modelConfig),
      setConfig: vi.fn(),
      getProjectConfigPath: vi.fn(() => path.join(process.cwd(), '.codemate', 'config.json')),
      getGlobalConfigPath: vi.fn(() => path.join(process.cwd(), '.codemate', 'global-config.json')),
    } as unknown as ConfigService;

    app = new Application(modelConfig, configService);

    // Mock AI 服务的方法
    const modelService = app.getContainer().get<ModelService>('model');
    const toolManager = app.getContainer().get<ToolManager>('tool');
    const sessionService = app.getContainer().get<SessionService>('session');
    const paths = app.getContainer().get<{
      getSessionLogPath: (sessionId: string) => string;
    }>('paths');

    sessionLogDir = path.join(
      process.cwd(),
      '.tmp',
      `app-ui-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    fs.mkdirSync(sessionLogDir, { recursive: true });
    vi.spyOn(paths, 'getSessionLogPath').mockImplementation((sessionId: string) =>
      path.join(sessionLogDir, `${sessionId}.jsonl`)
    );

    // 使用 vi.spyOn 来 mock 方法
    vi.spyOn(modelService, 'chatWithTools').mockResolvedValue({
      content: 'Hello from AI!',
      model: 'test-model',
    });

    vi.spyOn(toolManager, 'list').mockReturnValue(['read_file']);
    vi.spyOn(toolManager, 'get').mockReturnValue({
      name: 'read_file',
      description: 'Read file content',
    } as ReturnType<ToolManager['get']>);
    vi.spyOn(sessionService, 'list').mockReturnValue([]);
    vi.spyOn(sessionService, 'create').mockResolvedValue({
      id: 'test-session',
      messages: [],
      config: { summary: 'New conversation' },
    });
  });

  afterEach(() => {
    // 先卸载 Ink 树，避免异步 useEffect 在 mock 恢复后继续访问真实会话目录。
    cleanup();
    vi.restoreAllMocks();
    if (sessionLogDir) {
      fs.rmSync(sessionLogDir, { recursive: true, force: true });
    }
  });

  /**
   * 测试 1：应该渲染欢迎信息
   */
  it('should render welcome message', () => {
    const { lastFrame } = render(<App app={app} />);

    const output = lastFrame();
    expect(output).toContain('CodeMate Workbench');
    expect(output).toContain('CodeMate · v1.0.5');
    expect(output).toContain('Type your message or "/" for commands');
  });

  /**
   * 测试 2：应该显示输入提示符
   */
  it('should show input prompt', () => {
    const { lastFrame } = render(<App app={app} />);

    const output = lastFrame();
    expect(output).toContain('>');
  });

  it('should render the current workspace folder as the project label', () => {
    const { lastFrame } = render(<App app={app} />);
    const projectName = path.basename(process.cwd());

    expect(lastFrame()).toContain(projectName);
    expect(lastFrame()).not.toContain('ai-space');
  });

  /**
   * 测试 3：应该能创建 App 组件
   *
   * 注意：更复杂的交互测试（用户输入、加载状态、错误处理）
   * 在 Ink 中比较难以可靠地测试，建议通过手动测试验证
   */
  it('should create App component without errors', () => {
    expect(() => render(<App app={app} />)).not.toThrow();
  });

  it('should stop the app when exit_app is emitted', async () => {
    const stopSpy = vi.spyOn(app, 'stop').mockResolvedValue(undefined);
    render(<App app={app} />);

    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(async () => {
      eventBus.emit('exit_app');
      await Promise.resolve();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  it('should keep the CLI open and close transient UI on Ctrl+C', async () => {
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('agent_loop_event')).toBeGreaterThan(0);
    });

    await vi.waitFor(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
      expect(lastFrame()).toContain('Select Model');
    });

    await act(async () => {
      process.stdin.emit('data', Buffer.from('\u0003'));
    });

    await vi.waitFor(() => {
      expect(lastFrame()).toBeTruthy();
      expect(lastFrame()).not.toContain('Select Model');
    });
  });

  it('should stop the app on Ctrl+C when no transient UI is open', async () => {
    const stopSpy = vi.spyOn(app, 'stop').mockResolvedValue(undefined);
    render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('agent_loop_event')).toBeGreaterThan(0);
    });

    await act(async () => {
      process.stdin.emit('data', Buffer.from('\u0003'));
    });

    await vi.waitFor(() => {
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  it('should cancel the active run on Ctrl+C before exiting the app', async () => {
    const stopSpy = vi.spyOn(app, 'stop').mockResolvedValue(undefined);
    const cancelSpy = vi
      .spyOn(app.getContainer().get<AgentLoop>('agentLoop'), 'cancelActiveRun')
      .mockReturnValue(true);
    render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('agent_loop_event')).toBeGreaterThan(0);
    });

    await act(async () => {
      eventBus.emit(
        'agent_loop_event',
        createAgentLoopEvent({
          runId: 'run-1',
          operationId: 'run-1:tool:1:read_file',
          runtimeKind: 'tool',
          lifecycle: 'started',
          phase: 'executing',
          description: 'Reading file: src/ui/App.tsx',
          timestamp: 1_000,
        })
      );
      await Promise.resolve();
    });

    await act(async () => {
      process.stdin.emit('data', Buffer.from('\u0003'));
    });

    await vi.waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();
    });
  });

  it('should render approval requests and approve them from the keyboard', async () => {
    const { stdin, lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const responseHandler = vi.fn();
    eventBus.on('tool_approval_response', responseHandler);

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('tool_approval_request')).toBeGreaterThan(0);
    });

    await act(async () => {
      eventBus.emit('tool_approval_request', createApprovalRequest());
    });

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Approval Needed');
      expect(lastFrame()).toContain('edit_file');
      expect(lastFrame()).toContain('+ const value = 2;');
      expect(lastFrame()).toContain('no Enter');
      expect(latestTextInputProps?.focus).toBe(false);
      expect(latestTextInputProps?.placeholder).toContain('press a to approve');
    });

    await act(async () => {
      stdin.write('a');
    });

    await vi.waitFor(() => {
      expect(responseHandler).toHaveBeenCalledWith({
        requestId: 'approval-1',
        approved: true,
      });
      expect(lastFrame()).not.toContain('Approval Needed');
    });
  });

  it('should replace a running tool activity with its completed lifecycle event', async () => {
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('agent_loop_event')).toBeGreaterThan(0);
      expect(lastFrame()).toContain('Type your message or "/" for commands');
    });

    await act(async () => {
      eventBus.emit(
        'agent_loop_event',
        createAgentLoopEvent({
          runId: 'run-1',
          operationId: 'run-1:tool:1:read_file',
          lifecycle: 'started',
          phase: 'executing',
          description: 'Reading file: src/ui/App.tsx',
          timestamp: 1_000,
        })
      );
      eventBus.emit(
        'agent_loop_event',
        createAgentLoopEvent({
          runId: 'run-1',
          operationId: 'run-1:tool:1:read_file',
          lifecycle: 'completed',
          phase: 'executing',
          description: 'Reading file completed',
          timestamp: 1_500,
        })
      );
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      const output = lastFrame() ?? '';
      expect(output).toContain('Reading file completed');
      expect(output).not.toContain('Reading file: src/ui/App.tsx');
      expect(output).toContain('DONE');
      expect(output).not.toContain('RUNNING');
    });
  });

  it('should render streamed model reasoning while the run is active', async () => {
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('model_stream_event')).toBeGreaterThan(0);
    });

    await act(async () => {
      eventBus.emit('model_stream_event', {
        runId: 'run-1',
        kind: 'reasoning',
        delta: 'Inspecting the sidebar before editing',
        timestamp: Date.now(),
      });
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(lastFrame()).toContain('Thinking');
    expect(lastFrame()).toContain('Inspecting the sidebar before editing');
    expect(lastFrame()).toContain('chars');
  });

  it('should pause live model output repainting while the user is typing a draft', async () => {
    vi.useFakeTimers();
    try {
      const { lastFrame } = render(<App app={app} />);
      const eventBus = app.getContainer().get<EventBus>('eventBus');

      await vi.waitFor(() => {
        expect(eventBus.listenerCount('model_stream_event')).toBeGreaterThan(0);
        expect(latestTextInputProps?.onChange).toBeTypeOf('function');
      });

      await act(async () => {
        latestTextInputProps?.onChange?.('queue another change');
        eventBus.emit('model_stream_event', {
          runId: 'run-typing',
          kind: 'reasoning',
          delta: 'This should stay buffered while typing',
          timestamp: 1_000,
        });
        vi.advanceTimersByTime(1_000);
      });

      expect(lastFrame()).not.toContain('This should stay buffered while typing');

      await act(async () => {
        latestTextInputProps?.onChange?.('');
        await Promise.resolve();
      });

      expect(lastFrame()).toContain('This should stay buffered while typing');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should render a failed live stage before clearing it later', async () => {
    vi.useFakeTimers();
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      eventBus.emit('model_stream_event', {
        runId: 'run-1',
        kind: 'reasoning',
        delta: 'Inspecting the sidebar before editing',
        timestamp: 1_000,
      });
      eventBus.emit(
        'agent_loop_event',
        createAgentLoopEvent({
          runId: 'run-1',
          phase: 'failed',
          description: 'Agent run failed',
          timestamp: 1_001,
          error: 'tool crashed',
        })
      );
      await Promise.resolve();
    });

    expect(lastFrame()).toContain('Failed');
    expect(lastFrame()).toContain('Run failed');

    await act(async () => {
      vi.advanceTimersByTime(999);
      await Promise.resolve();
    });

    expect(lastFrame()).toContain('Failed');

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(lastFrame()).not.toContain('Failed');
    vi.useRealTimers();
  });

  it('should keep the same input mounted across overlay and active-run transitions', async () => {
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    let baselineMountCount = 0;
    let baselineUnmountCount = 0;

    await vi.waitFor(() => {
      expect(textInputMountCount).toBeGreaterThan(0);
      expect(latestTextInputProps?.focus).toBe(true);
      expect(lastFrame()).toContain('Type your message or "/" for commands');
    });
    baselineMountCount = textInputMountCount;
    baselineUnmountCount = textInputUnmountCount;

    await act(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Select Model');
      expect(textInputMountCount).toBe(baselineMountCount);
      expect(textInputUnmountCount).toBe(baselineUnmountCount);
      expect(latestTextInputProps?.focus).toBe(false);
    });

    await act(async () => {
      process.stdin.emit('data', Buffer.from('\u0003'));
    });

    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Select Model');
      expect(textInputMountCount).toBe(baselineMountCount);
      expect(textInputUnmountCount).toBe(baselineUnmountCount);
      expect(latestTextInputProps?.focus).toBe(true);
    });

    await act(async () => {
      eventBus.emit(
        'agent_loop_event',
        createAgentLoopEvent({
          runId: 'run-1',
          operationId: 'run-1:tool:1:read_file',
          runtimeKind: 'tool',
          lifecycle: 'started',
          phase: 'executing',
          description: 'Reading file: src/ui/App.tsx',
          timestamp: 1_000,
        })
      );
      await Promise.resolve();
    });

    expect(textInputMountCount).toBe(baselineMountCount);
    expect(textInputUnmountCount).toBe(baselineUnmountCount);
    expect(latestTextInputProps?.focus).toBe(true);
    expect(lastFrame()).toContain('Type your message or "/" for commands');
  });

  it('should queue a second request and execute it after the active run completes', async () => {
    const agentLoop = app.getContainer().get<AgentLoop>('agentLoop');
    const firstRun = deferred<Awaited<ReturnType<AgentLoop['execute']>>>();
    const executeSpy = vi
      .spyOn(agentLoop, 'execute')
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValueOnce(agentResult('run-2'));
    const { lastFrame } = render(<App app={app} />);

    await vi.waitFor(() => {
      expect(latestTextInputProps?.focus).toBe(true);
      expect(lastFrame()).toContain('ID test-ses');
    });

    await act(async () => {
      latestTextInputProps?.onSubmit?.('first request');
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));

    await act(async () => {
      latestTextInputProps?.onSubmit?.('second request');
      await Promise.resolve();
    });

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(lastFrame()).toContain('Queued · 1');
    expect(lastFrame()).toContain('second request');

    await act(async () => {
      firstRun.resolve(agentResult('run-1'));
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(executeSpy).toHaveBeenNthCalledWith(2, 'second request');
    });
  });

  it('should pin approval cards above the input and defocus text entry', async () => {
    const { lastFrame } = render(<App app={app} />);
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    await vi.waitFor(() => {
      expect(eventBus.listenerCount('tool_approval_request')).toBeGreaterThan(0);
      expect(latestTextInputProps?.focus).toBe(true);
    });

    await act(async () => {
      eventBus.emit('tool_approval_request', {
        ...createApprovalRequest(),
        toolName: 'bash',
        approval: {
          status: 'requires_approval',
          risk: 'execute',
          reason: 'bash requires user approval in autoEdit mode.',
        },
        preview: {
          kind: 'none',
          beforeExists: false,
          summary: 'No preview available for this tool call.',
        },
      });
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      const output = lastFrame() ?? '';
      const approvalIndex = output.indexOf('Approval Needed');
      const inputHintIndex = output.indexOf('Approval pending: press a to approve');

      expect(approvalIndex).toBeGreaterThanOrEqual(0);
      expect(inputHintIndex).toBeGreaterThan(approvalIndex);
      expect(latestTextInputProps?.focus).toBe(false);
      expect(latestTextInputProps?.placeholder).toContain('press a to approve');
    });
  });

  it('should remove the newest queued request with Ctrl+X', async () => {
    const agentLoop = app.getContainer().get<AgentLoop>('agentLoop');
    const firstRun = deferred<Awaited<ReturnType<AgentLoop['execute']>>>();
    vi.spyOn(agentLoop, 'execute').mockReturnValueOnce(firstRun.promise);
    const { lastFrame } = render(<App app={app} />);

    await vi.waitFor(() => expect(lastFrame()).toContain('ID test-ses'));
    await act(async () => {
      latestTextInputProps?.onSubmit?.('first request');
      await Promise.resolve();
    });
    await act(async () => {
      latestTextInputProps?.onSubmit?.('queued request');
      await Promise.resolve();
    });
    expect(lastFrame()).toContain('Queued · 1');

    await act(async () => {
      process.stdin.emit('data', Buffer.from('\u0018'));
      await Promise.resolve();
    });

    expect(lastFrame()).not.toContain('Queued · 1');
    firstRun.resolve(agentResult('run-1'));
  });

  it('persists a selected model and reports the actual config path', async () => {
    const sessionService = app.getContainer().get<SessionService>('session');
    const addMessageSpy = vi.spyOn(sessionService, 'addMessage');
    const modelService = app.getContainer().get<ModelService>('model');
    const updateConfigSpy = vi.spyOn(modelService, 'updateConfig');
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const modelChangedSpy = vi.fn();
    eventBus.on('model_changed', modelChangedSpy);
    const { stdin, lastFrame } = render(<App app={app} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Type your message or "/" for commands');
    });

    sessionService.setCurrent({
      id: 'test-session',
      messages: [],
      config: { summary: 'New conversation' },
    });

    await vi.waitFor(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
      expect(lastFrame()).toContain('Select Model');
      expect(lastFrame()).toContain('Current model: deepseek-chat');
      expect(latestModelSelectorProps?.currentModelId).toBe('deepseek-chat');
    });

    await act(async () => {
      latestModelSelectorProps?.onSelect('deepseek-reasoner');
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(configService.setConfig).toHaveBeenCalledWith(false, 'model', 'deepseek-reasoner');
      expect(updateConfigSpy).toHaveBeenCalledWith({ model: 'deepseek-reasoner' });
      expect(modelChangedSpy).toHaveBeenCalledWith({
        previousModel: 'deepseek-chat',
        newModel: 'deepseek-reasoner',
        configPath: path.join(process.cwd(), '.codemate', 'config.json'),
      });
      expect(lastFrame()).toContain('deepseek-reasoner');
      expect(lastFrame()).toContain('Saved to');
      expect(lastFrame()).toContain(path.join(process.cwd(), '.codemate', 'config.json'));
      expect(lastFrame()).toContain('Restart persistence verified');
      expect(lastFrame()).not.toContain('change is temporary');
      expect(addMessageSpy).toHaveBeenCalled();
    });
  });

  it('rolls back the model selection if project config persistence fails', async () => {
    vi.mocked(configService.setConfig).mockImplementation(() => {
      throw new Error('disk full');
    });

    const sessionService = app.getContainer().get<SessionService>('session');
    const addMessageSpy = vi.spyOn(sessionService, 'addMessage');
    const modelService = app.getContainer().get<ModelService>('model');
    const updateConfigSpy = vi.spyOn(modelService, 'updateConfig');
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const modelChangedSpy = vi.fn();
    eventBus.on('model_changed', modelChangedSpy);
    const { stdin, lastFrame } = render(<App app={app} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Type your message or "/" for commands');
    });

    sessionService.setCurrent({
      id: 'test-session',
      messages: [],
      config: { summary: 'New conversation' },
    });

    await vi.waitFor(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
      expect(lastFrame()).toContain('Select Model');
      expect(latestModelSelectorProps?.currentModelId).toBe('deepseek-chat');
    });

    await act(async () => {
      latestModelSelectorProps?.onSelect('deepseek-reasoner');
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(updateConfigSpy).toHaveBeenCalledWith({ model: 'deepseek-chat' });
      expect(updateConfigSpy).not.toHaveBeenCalledWith({ model: 'deepseek-reasoner' });
      expect(lastFrame()).toContain('Failed to change model to deepseek-reasoner: disk full');
      expect(lastFrame()).toContain('deepseek-chat');
      expect(lastFrame()).not.toContain('Saved to');
      expect(lastFrame()).not.toContain('Restart persistence verified');
      expect(modelChangedSpy).not.toHaveBeenCalled();
      expect(addMessageSpy).toHaveBeenCalled();
    });
  });

  it('restores the previous project model if a later step fails after config persistence succeeds', async () => {
    const sessionService = app.getContainer().get<SessionService>('session');
    const addMessageSpy = vi
      .spyOn(sessionService, 'addMessage')
      .mockRejectedValueOnce(new Error('message write failed'))
      .mockRejectedValueOnce(new Error('report write failed'));
    const modelService = app.getContainer().get<ModelService>('model');
    const updateConfigSpy = vi.spyOn(modelService, 'updateConfig');
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const modelChangedSpy = vi.fn();
    eventBus.on('model_changed', modelChangedSpy);
    const { lastFrame } = render(<App app={app} />);

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Type your message or "/" for commands');
    });

    sessionService.setCurrent({
      id: 'test-session',
      messages: [],
      config: { summary: 'New conversation' },
    });

    await vi.waitFor(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
      expect(lastFrame()).toContain('Select Model');
      expect(latestModelSelectorProps?.currentModelId).toBe('deepseek-chat');
    });

    await act(async () => {
      latestModelSelectorProps?.onSelect('deepseek-reasoner');
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(configService.setConfig).toHaveBeenNthCalledWith(
        1,
        false,
        'model',
        'deepseek-reasoner'
      );
      expect(configService.setConfig).toHaveBeenNthCalledWith(2, false, 'model', 'deepseek-chat');
      expect(updateConfigSpy).toHaveBeenNthCalledWith(1, { model: 'deepseek-reasoner' });
      expect(updateConfigSpy).toHaveBeenNthCalledWith(2, { model: 'deepseek-chat' });
      expect(addMessageSpy).toHaveBeenCalledTimes(2);
      expect(addMessageSpy.mock.calls[0]?.[0]).toMatchObject({
        role: 'assistant',
        content: expect.stringContaining('✅ Model changed to deepseek-reasoner'),
      });
      expect(addMessageSpy.mock.calls[1]?.[0]).toMatchObject({
        role: 'assistant',
        content: 'Failed to change model to deepseek-reasoner: message write failed',
      });
      expect(modelChangedSpy).not.toHaveBeenCalled();
      expect(lastFrame()).not.toContain('Saved to');
    });

    await vi.waitFor(async () => {
      eventBus.emit('show_model_selector');
      await Promise.resolve();
      expect(lastFrame()).toContain('Select Model');
      expect(latestModelSelectorProps?.currentModelId).toBe('deepseek-chat');
    });
  });
});

function createApprovalRequest(): ToolApprovalRequest {
  return {
    id: 'approval-1',
    toolName: 'edit_file',
    input: {},
    approval: {
      status: 'requires_approval',
      risk: 'write',
      reason: 'edit_file requires user approval in default mode.',
    },
    preview: {
      kind: 'file_diff',
      relativePath: 'src/app.ts',
      beforeExists: true,
      summary: 'File change preview for src/app.ts',
      diff: '- const value = 1;\n+ const value = 2;',
    },
    terminalPreview: '',
    timestamp: 1_000,
  };
}

function createAgentLoopEvent(event: AgentLoopEvent): AgentLoopEvent {
  return event;
}

function agentResult(runId: string): Awaited<ReturnType<AgentLoop['execute']>> {
  return {
    runId,
    success: true,
    response: { content: 'Done', model: 'test-model' },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
