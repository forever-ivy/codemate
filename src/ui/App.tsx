import { Box, useApp, useInput } from 'ink';
import * as path from 'pathe';
import React, { useState, useMemo, useCallback, useRef, useEffect, useReducer } from 'react';
import type { AgentLoop, AgentLoopEvent } from '../agents/AgentLoop';
import type { Application } from '../application/Application';
import type { SlashCommandManager } from '../managers/SlashCommandManager';
import type { ConfigService } from '../services/ConfigService';
import type { EventBus } from '../services/EventBus';
import type { ModelService, ModelStreamEvent } from '../services/ModelService';
import type {
  ToolApprovalRequest,
  ToolApprovalResponse,
} from '../tools/ToolApprovalRequestService';
import type { EnhancedMessage, Message, MessageRole } from '../types/index';
import { AgentWorkbench } from './components/AgentWorkbench.js';
import type { LiveModelOutputState } from './components/LiveModelOutput.js';
import { MCPManager } from './components/MCPManager.js';
import { ModelSelector } from './components/ModelSelector.js';
import { ResumeSelector } from './components/ResumeSelector.js';
import { RewindSelector } from './components/RewindSelector.js';
import { SimpleInput } from './components/SimpleInput.js';
import { StatusBar } from './components/StatusBar.js';
import { StatusManager } from './components/StatusManager.js';
import { ToolApprovalCard } from './components/ToolApprovalCard.js';
import { AppContextProvider, useAppContext } from './context/AppContext';
import { useSession } from './hooks/useSession';
import { useAgentMessageQueue } from './hooks/useAgentMessageQueue';
import { useTerminalRefresh } from './hooks/useTerminalRefresh';
import { ThemeProvider } from './theme/ThemeSystem.js';
import { clearTerminal } from './utils/terminal';
import {
  type AgentActivityState,
  createAgentActivityState,
  reduceAgentActivity,
  selectLiveActivities,
} from './workbench/AgentActivityReducer';
import { type AgentRunSummary, buildAgentRunSummary } from './workbench/AgentRunSummaryService';
import { buildAgentRunTelemetry } from './workbench/AgentRunTelemetryService';
import {
  selectTypingProtectedWorkbenchState,
  type TypingProtectedWorkbenchState,
} from './workbench/TypingProtectedWorkbenchState';

/**
 * App 组件的 Props
 */
interface AppProps {
  app: Application;
}

function toSessionMessages(messages: EnhancedMessage[]): Message[] {
  return messages.map((message) => ({
    role: message.role as MessageRole,
    content:
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
  }));
}

/**
 * Derives the terminal project label from the active workspace directory.
 *
 * 调用链路：
 * Application -> Paths.getCwd -> AppContent -> AgentWorkbench / StatusBar
 *
 * The UI should show the project the user launched the CLI from, not a
 * hard-coded product or demo name. The fallback keeps detached tests and
 * unusual root paths readable.
 */
function projectNameFromCwd(cwd: string): string {
  const normalized = cwd.replace(/[\\/]+$/, '');
  return path.basename(normalized) || normalized || 'workspace';
}

function currentStageLabel(output?: LiveModelOutputState): string {
  if (!output) {
    return '';
  }

  switch (output.stage) {
    case 'reasoning':
      return 'Thinking';
    case 'text':
      return 'Responding';
    case 'tool':
      return output.toolName ? `Running ${output.toolName}` : 'Running tool';
    case 'step':
      return 'Step completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return output.reasoning ? 'Thinking' : output.text ? 'Responding' : '';
  }
}

const LIVE_MODEL_FLUSH_DELAY_MS = 500;
const LIVE_MODEL_TERMINAL_CLEAR_DELAY_MS = 1_000;
const LIVE_MODEL_RETAINED_CHARS = 600;

/**
 * AppContent 组件 - 带任务跟踪的版本
 */
function AppContent() {
  const { currentSession, sessionService } = useSession();
  const { app, transcriptMode, toggleTranscriptMode } = useAppContext();
  const { terminalWidth } = useTerminalRefresh();
  const { exit } = useApp();

  // 使用useRef避免不必要的重新渲染
  const statusRef = useRef<'idle' | 'thinking' | 'streaming' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicMessageStartIndex, setDynamicMessageStartIndex] = useState<number>();
  const isAgentRunningRef = useRef(false);
  const messageQueue = useAgentMessageQueue();
  const executeRequestRef = useRef<((value: string) => Promise<void>) | undefined>(undefined);

  const [activityState, dispatchActivity] = useReducer(
    reduceAgentActivity,
    undefined,
    createAgentActivityState
  );
  const activityStateRef = useRef<AgentActivityState>(createAgentActivityState());
  const [runSummaries, setRunSummaries] = useState<AgentRunSummary[]>([]);
  const [liveModelOutput, setLiveModelOutput] = useState<LiveModelOutputState>();
  const liveModelBufferRef = useRef<LiveModelOutputState | undefined>(undefined);
  const liveModelFlushTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const liveModelClearTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputDraftActiveRef = useRef(false);
  const [inputDraftActive, setInputDraftActive] = useState(false);
  const liveModelFlushPausedByInputRef = useRef(false);
  const [pendingApproval, setPendingApproval] = useState<ToolApprovalRequest | undefined>();
  const liveActivities = useMemo(() => selectLiveActivities(activityState), [activityState]);
  const rawCurrentTask = pendingApproval?.toolName
    ? `Approval required: ${pendingApproval.toolName}`
    : currentStageLabel(liveModelOutput) ||
      (liveActivities.find((item) => item.status === 'running')?.description ?? '');
  const rawWorkbenchState = useMemo<TypingProtectedWorkbenchState>(
    () => ({
      tasks: liveActivities,
      currentTask: rawCurrentTask,
      liveModelOutput,
    }),
    [liveActivities, rawCurrentTask, liveModelOutput]
  );
  const stableWorkbenchStateRef = useRef<TypingProtectedWorkbenchState | undefined>(undefined);
  const protectTypingFrame = inputDraftActive && !pendingApproval;
  const visibleWorkbenchState = useMemo(
    () =>
      selectTypingProtectedWorkbenchState({
        current: rawWorkbenchState,
        previous: stableWorkbenchStateRef.current,
        inputDraftActive: protectTypingFrame,
      }),
    [protectTypingFrame, rawWorkbenchState]
  );

  useEffect(() => {
    if (!protectTypingFrame) {
      stableWorkbenchStateRef.current = rawWorkbenchState;
    }
  }, [protectTypingFrame, rawWorkbenchState]);

  // 模型选择器状态
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(
    () => app.getContainer().get<ModelService>('model').getConfig().model
  );
  const projectName = useMemo(
    () => projectNameFromCwd(app.getContainer().get<{ getCwd(): string }>('paths').getCwd()),
    [app]
  );

  // 回退选择器状态
  const [showRewindSelector, setShowRewindSelector] = useState(false);

  // Resume选择器状态
  const [showResumeSelector, setShowResumeSelector] = useState(false);

  // MCP管理器状态
  const [showMcpManager, setShowMcpManager] = useState(false);

  // Status管理器状态
  const [showStatusManager, setShowStatusManager] = useState(false);

  const resetTransientUi = useCallback(() => {
    setShowModelSelector(false);
    setShowRewindSelector(false);
    setShowResumeSelector(false);
    setShowMcpManager(false);
    setShowStatusManager(false);
  }, []);

  const requestAppExit = useCallback(async () => {
    messageQueue.clear();
    try {
      await app.stop();
    } finally {
      exit();
    }
  }, [app, exit, messageQueue.clear]);

  // 关键：使用ref来存储消息，避免频繁的状态更新
  const messagesRef = useRef<EnhancedMessage[]>([]);
  const [, forceUpdate] = useState({});

  // 稳定的消息列表 - 直接从ref获取，避免useMemo重新计算
  const historyMessages = messagesRef.current;
  const currentMessages = currentSession?.messages;

  // 更新消息ref当session变化时
  useEffect(() => {
    if (currentMessages) {
      messagesRef.current = currentMessages as EnhancedMessage[];
      forceUpdate({}); // 强制更新一次UI
    }
  }, [currentMessages]);

  const cancelLiveModelFlush = useCallback(() => {
    if (liveModelFlushTimerRef.current) {
      clearTimeout(liveModelFlushTimerRef.current);
      liveModelFlushTimerRef.current = undefined;
    }
  }, []);

  const cancelLiveModelClear = useCallback(() => {
    if (liveModelClearTimerRef.current) {
      clearTimeout(liveModelClearTimerRef.current);
      liveModelClearTimerRef.current = undefined;
    }
  }, []);

  const snapshotLiveModelOutput = useCallback((output?: LiveModelOutputState) => {
    setLiveModelOutput(output ? { ...output } : undefined);
  }, []);

  const scheduleLiveModelFlush = useCallback(() => {
    if (liveModelFlushTimerRef.current) {
      return;
    }

    if (inputDraftActiveRef.current) {
      liveModelFlushPausedByInputRef.current = true;
      return;
    }

    liveModelFlushTimerRef.current = setTimeout(() => {
      snapshotLiveModelOutput(liveModelBufferRef.current);
      liveModelFlushTimerRef.current = undefined;
    }, LIVE_MODEL_FLUSH_DELAY_MS);
  }, [snapshotLiveModelOutput]);

  const handleInputDraftChange = useCallback(
    (value: string) => {
      const hasDraft = value.length > 0;
      inputDraftActiveRef.current = hasDraft;
      setInputDraftActive(hasDraft);

      if (!hasDraft && liveModelFlushPausedByInputRef.current) {
        liveModelFlushPausedByInputRef.current = false;
        snapshotLiveModelOutput(liveModelBufferRef.current);
      }
    },
    [snapshotLiveModelOutput]
  );

  const resetLiveModelState = useCallback(() => {
    cancelLiveModelFlush();
    cancelLiveModelClear();
    liveModelBufferRef.current = undefined;
    snapshotLiveModelOutput(undefined);
  }, [cancelLiveModelClear, cancelLiveModelFlush, snapshotLiveModelOutput]);

  const showTerminalLiveModelStage = useCallback(
    (
      runId: string,
      stage: NonNullable<LiveModelOutputState['stage']>,
      patch?: Partial<LiveModelOutputState>
    ) => {
      cancelLiveModelFlush();
      cancelLiveModelClear();

      const previous =
        liveModelBufferRef.current?.runId === runId
          ? liveModelBufferRef.current
          : liveModelOutput?.runId === runId
            ? liveModelOutput
            : { runId, reasoning: '', text: '' };
      const next = { ...previous, ...patch, stage };
      liveModelBufferRef.current = next;
      snapshotLiveModelOutput(next);

      liveModelClearTimerRef.current = setTimeout(() => {
        if (liveModelBufferRef.current?.runId === runId) {
          liveModelBufferRef.current = undefined;
        }
        setLiveModelOutput((current) => (current?.runId === runId ? undefined : current));
        liveModelClearTimerRef.current = undefined;
      }, LIVE_MODEL_TERMINAL_CLEAR_DELAY_MS);
    },
    [cancelLiveModelClear, cancelLiveModelFlush, liveModelOutput, snapshotLiveModelOutput]
  );

  const patchLiveModelOutput = useCallback(
    (
      runId: string,
      patch: Partial<LiveModelOutputState>,
      update?: (state: LiveModelOutputState) => LiveModelOutputState
    ) => {
      cancelLiveModelClear();

      const previous =
        liveModelBufferRef.current?.runId === runId
          ? liveModelBufferRef.current
          : { runId, reasoning: '', text: '' };
      const next = update ? update(previous) : { ...previous, ...patch };
      liveModelBufferRef.current = next;
      scheduleLiveModelFlush();
    },
    [cancelLiveModelClear, scheduleLiveModelFlush]
  );

  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleAgentLoopEvent = (event: AgentLoopEvent) => {
      activityStateRef.current = reduceAgentActivity(activityStateRef.current, event);
      dispatchActivity(event);

      if (event.runtimeKind === 'reasoning') {
        patchLiveModelOutput(event.runId, { stage: 'reasoning' });
      } else if (event.runtimeKind === 'text') {
        patchLiveModelOutput(event.runId, { stage: 'text' });
      } else if (event.runtimeKind === 'tool') {
        patchLiveModelOutput(event.runId, { stage: 'tool' });
      } else if (event.runtimeKind === 'step') {
        patchLiveModelOutput(event.runId, { stage: 'step' });
      } else if (event.runtimeKind === 'run' && event.lifecycle === 'cancelled') {
        showTerminalLiveModelStage(event.runId, 'cancelled');
      } else if (event.lifecycle === 'failed' || event.phase === 'failed') {
        showTerminalLiveModelStage(event.runId, 'failed');
      }

      switch (event.phase) {
        case 'received':
        case 'snapshot':
        case 'intent':
        case 'context':
        case 'planning':
        case 'verifying':
        case 'repairing':
        case 'executing':
        case 'responding':
          statusRef.current =
            event.phase === 'executing' ||
            event.phase === 'verifying' ||
            event.phase === 'repairing'
              ? 'streaming'
              : 'thinking';
          break;
        case 'completed':
          statusRef.current = 'idle';
          resetLiveModelState();
          break;
        case 'incomplete':
          statusRef.current = 'error';
          break;
        case 'failed':
          statusRef.current = 'error';
          break;
      }
    };

    eventBus.on('agent_loop_event', handleAgentLoopEvent);

    return () => {
      eventBus.off('agent_loop_event', handleAgentLoopEvent);
    };
  }, [app, patchLiveModelOutput, resetLiveModelState, showTerminalLiveModelStage]);

  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const handleModelStreamEvent = (event: ModelStreamEvent) => {
      patchLiveModelOutput(event.runId, {}, (previous) => ({
        ...previous,
        stage: event.kind === 'reasoning' ? 'reasoning' : event.kind === 'text' ? 'text' : 'tool',
        reasoning:
          event.kind === 'reasoning'
            ? `${previous.reasoning}${event.delta}`.slice(-LIVE_MODEL_RETAINED_CHARS)
            : previous.reasoning,
        text:
          event.kind === 'text'
            ? `${previous.text}${event.delta}`.slice(-LIVE_MODEL_RETAINED_CHARS)
            : previous.text,
        toolName: event.kind === 'tool' ? event.delta : previous.toolName,
      }));
      statusRef.current = 'streaming';
    };

    eventBus.on('model_stream_event', handleModelStreamEvent);
    return () => {
      eventBus.off('model_stream_event', handleModelStreamEvent);
      cancelLiveModelFlush();
      cancelLiveModelClear();
    };
  }, [app, cancelLiveModelClear, cancelLiveModelFlush, patchLiveModelOutput]);

  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const handleApprovalRequest = (request: ToolApprovalRequest) => {
      setPendingApproval(request);
      statusRef.current = 'streaming';
    };

    eventBus.on('tool_approval_request', handleApprovalRequest);

    return () => {
      eventBus.off('tool_approval_request', handleApprovalRequest);
    };
  }, [app]);

  const respondToApproval = useCallback(
    (response: Omit<ToolApprovalResponse, 'requestId'>) => {
      if (!pendingApproval) {
        return;
      }

      const eventBus = app.getContainer().get<EventBus>('eventBus');
      eventBus.emit('tool_approval_response', {
        requestId: pendingApproval.id,
        ...response,
      });
      setPendingApproval(undefined);
      statusRef.current = 'idle';
    },
    [app, pendingApproval]
  );

  const keyboardInterruptStateRef = useRef({
    transcriptMode,
    pendingApproval,
    showModelSelector,
    showRewindSelector,
    showResumeSelector,
    showMcpManager,
    showStatusManager,
    isRunActive: false,
  });
  keyboardInterruptStateRef.current = {
    transcriptMode,
    pendingApproval,
    showModelSelector,
    showRewindSelector,
    showResumeSelector,
    showMcpManager,
    showStatusManager,
    isRunActive: isLoading || activityState.phase === 'running',
  };

  const handleKeyboardInterrupt = useCallback(() => {
    const state = keyboardInterruptStateRef.current;

    if (state.transcriptMode) {
      clearTerminal();
      toggleTranscriptMode();
      return;
    }

    if (state.pendingApproval) {
      respondToApproval({
        approved: false,
        reason: 'User cancelled the approval card',
      });
      return;
    }

    if (
      state.showModelSelector ||
      state.showRewindSelector ||
      state.showResumeSelector ||
      state.showMcpManager ||
      state.showStatusManager
    ) {
      resetTransientUi();
      return;
    }

    if (state.isRunActive) {
      const agentLoop = app.getContainer().get<AgentLoop>('agentLoop');
      if (agentLoop.cancelActiveRun()) {
        return;
      }
    }

    void requestAppExit();
  }, [app, toggleTranscriptMode, respondToApproval, resetTransientUi, requestAppExit]);

  useEffect(() => {
    const handleData = (chunk: Buffer | string) => {
      const input = chunk.toString();
      if (input.includes('\u0003')) {
        handleKeyboardInterrupt();
        return;
      }

      if (input.includes('\u0018')) {
        const newest = messageQueue.queuedMessages.at(-1);
        if (newest) {
          messageQueue.remove(newest.id);
        }
      }
    };

    process.stdin.on('data', handleData);
    return () => {
      process.stdin.off('data', handleData);
    };
  }, [handleKeyboardInterrupt, messageQueue.queuedMessages, messageQueue.remove]);

  // 全局键盘处理
  useInput(
    useCallback(
      (input, key) => {
        if (key.ctrl && (input === 'c' || input === '\u0003')) {
          handleKeyboardInterrupt();
          return;
        }

        // Ctrl+O: 切换transcript模式
        if (key.ctrl && input === 'o') {
          clearTerminal();
          toggleTranscriptMode();
          return;
        }

        // 在transcript模式下，Escape或Ctrl+C退出
        if (transcriptMode) {
          if (key.escape) {
            clearTerminal();
            toggleTranscriptMode();
          }
          return;
        }

        if (pendingApproval) {
          const normalizedInput = input.toLowerCase();
          if (normalizedInput === 'a') {
            respondToApproval({ approved: true });
            return;
          }
          if (normalizedInput === 'd' || key.escape) {
            respondToApproval({
              approved: false,
              reason: 'User denied from approval card',
            });
            return;
          }
          return;
        }

        // 如果模型选择器或回退选择器打开，不处理其他键盘事件
        if (
          showModelSelector ||
          showRewindSelector ||
          showResumeSelector ||
          showMcpManager ||
          showStatusManager
        ) {
          return;
        }
      },
      [
        transcriptMode,
        toggleTranscriptMode,
        showModelSelector,
        showRewindSelector,
        showResumeSelector,
        showMcpManager,
        showStatusManager,
        handleKeyboardInterrupt,
        pendingApproval,
        respondToApproval,
      ]
    )
  );

  /** Runs exactly one request. The queue starts the next request only after this promise settles. */
  const executeRequest = useCallback(
    async (value: string) => {
      isAgentRunningRef.current = true;
      setDynamicMessageStartIndex(messagesRef.current.length);
      setRunSummaries([]);
      statusRef.current = 'thinking';
      setIsLoading(true);

      try {
        const agentLoop = app.getContainer().get<AgentLoop>('agentLoop');
        const result = await agentLoop.execute(value);

        const structuredOutput = result.structuredOutput;
        if (structuredOutput) {
          const telemetry = buildAgentRunTelemetry(activityStateRef.current.activities);
          setRunSummaries([buildAgentRunSummary(structuredOutput, telemetry)]);
        }

        statusRef.current = result.success ? 'idle' : 'error';
      } catch (error) {
        statusRef.current = 'error';
        const errorMessage: Message = {
          role: 'assistant',
          content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
        await sessionService.addMessage(errorMessage);

        setTimeout(() => {
          statusRef.current = 'idle';
        }, 3000);
      } finally {
        isAgentRunningRef.current = false;
        setDynamicMessageStartIndex(undefined);
        setIsLoading(false);

        // Let React commit the completed run before mounting the next dynamic tail.
        const next = messageQueue.takeNext();
        if (next) {
          queueMicrotask(() => void executeRequestRef.current?.(next.content));
        }
      }
    },
    [app, messageQueue.takeNext, sessionService]
  );
  executeRequestRef.current = executeRequest;

  /** Accepts user input immediately; busy runs enqueue normal requests instead of dropping them. */
  const handleSubmit = useCallback(
    async (value: string) => {
      const normalized = value.trim();
      if (!normalized || !currentSession) return;

      const commandManager = app.getContainer().get<SlashCommandManager>('command');
      if (commandManager.isCommand(normalized)) {
        const userMessage: Message = { role: 'user', content: value };
        await sessionService.addMessage(userMessage);
        await commandManager.execute(normalized, app);
        return;
      }

      if (normalized.toLowerCase() === 'exit' || normalized.toLowerCase() === 'quit') {
        await requestAppExit();
        return;
      }

      if (isAgentRunningRef.current) {
        messageQueue.enqueue(normalized);
        return;
      }

      await executeRequest(normalized);
    },
    [app, currentSession, executeRequest, messageQueue.enqueue, requestAppExit, sessionService]
  );

  // 模型选择器处理函数
  const handleModelSelect = useCallback(
    async (modelId: string) => {
      setShowModelSelector(false);

      const configService = app.getContainer().get<ConfigService>('config');
      const modelService = app.getContainer().get<ModelService>('model');
      const previousModelId = modelService.getConfig().model;

      if (modelId !== previousModelId) {
        let projectConfigPersisted = false;

        try {
          const configPath = configService.getProjectConfigPath();
          const missingApiKey = !configService.getModelConfig().apiKey;
          const eventBus = app.getContainer().get<EventBus>('eventBus');

          configService.setConfig(false, 'model', modelId);
          projectConfigPersisted = true;
          modelService.updateConfig({ model: modelId });
          setCurrentModelId(modelId);

          await sessionService.addMessage({
            role: 'assistant',
            content: `✅ Model changed to ${modelId}\nSaved to ${configPath}\nRestart persistence verified${missingApiKey ? '\n\n⚠️ No API key configured. Run `codemate config` or set the provider API key in the config file to use this model.' : ''}`,
          });

          eventBus.emit('model_changed', {
            previousModel: previousModelId,
            newModel: modelId,
            configPath,
          });
        } catch (error) {
          if (projectConfigPersisted) {
            try {
              configService.setConfig(false, 'model', previousModelId);
            } catch (rollbackError) {
              console.error('Failed to roll back project model config:', rollbackError);
            }
          }

          try {
            modelService.updateConfig({ model: previousModelId });
          } catch (rollbackError) {
            console.error('Failed to restore model service config:', rollbackError);
          }

          setCurrentModelId(previousModelId);

          // 显示错误消息
          try {
            await sessionService.addMessage({
              role: 'assistant',
              content: `Failed to change model to ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          } catch (reportError) {
            console.error('Failed to report model change error:', reportError);
          }
        }
      }
    },
    [app, sessionService]
  );

  const handleModelSelectorClose = useCallback(() => {
    setShowModelSelector(false);
  }, []);

  // 回退选择器处理函数
  const handleRewindSelect = useCallback(
    async (messageIndex: number) => {
      setShowRewindSelector(false);

      if (!currentSession) return;

      try {
        // 验证索引有效性
        if (messageIndex < 0 || messageIndex >= currentSession.messages.length) {
          await sessionService.addMessage({
            role: 'system',
            content: '❌ Invalid message index for rewind operation.',
          });
          return;
        }

        // 确保至少保留一条消息
        if (messageIndex === 0 && currentSession.messages.length > 1) {
          await sessionService.addMessage({
            role: 'system',
            content: '⚠️ Cannot rewind to the very first message. At least one message must remain.',
          });
          return;
        }

        // 截断消息到选择的索引点
        const truncatedMessages = currentSession.messages.slice(0, messageIndex + 1);

        // 更新会话消息（确保类型兼容）
        await sessionService.updateSessionMessages(
          currentSession.id,
          toSessionMessages(truncatedMessages as EnhancedMessage[])
        );

        // 显示成功消息
        await sessionService.addMessage({
          role: 'system',
          content: `✅ Conversation rewound to message ${messageIndex + 1}. You can continue from this point.`,
        });

        // 触发UI更新事件
        const eventBus = app.getContainer().get<EventBus>('eventBus');
        eventBus.emit('session_rewound', {
          sessionId: currentSession.id,
          messageIndex,
          remainingMessages: truncatedMessages.length,
        });
      } catch (error) {
        // 显示错误消息
        await sessionService.addMessage({
          role: 'system',
          content: `❌ Failed to rewind conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [currentSession, sessionService, app]
  );

  const handleRewindSelectorClose = useCallback(() => {
    setShowRewindSelector(false);
  }, []);

  // Resume选择器处理函数
  const handleResumeSelect = useCallback(
    async (sessionId: string) => {
      setShowResumeSelector(false);

      try {
        await sessionService.resume(sessionId);
        // 显示成功消息
        await sessionService.addMessage({
          role: 'system',
          content: `✅ Session resumed: ${sessionId}`,
        });
      } catch (error) {
        // 显示错误消息
        await sessionService.addMessage({
          role: 'system',
          content: `❌ Failed to resume session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    [sessionService]
  );

  const handleResumeSelectorClose = useCallback(() => {
    setShowResumeSelector(false);
  }, []);

  // 监听模型命令事件
  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleShowModelSelector = () => {
      setShowModelSelector(true);
    };

    eventBus.on('show_model_selector', handleShowModelSelector);

    return () => {
      eventBus.off('show_model_selector', handleShowModelSelector);
    };
  }, [app]);

  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleExitApp = () => {
      void requestAppExit();
    };

    eventBus.on('exit_app', handleExitApp);

    return () => {
      eventBus.off('exit_app', handleExitApp);
    };
  }, [app, requestAppExit]);

  // 监听回退命令事件
  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleShowRewindSelector = () => {
      if (!currentSession || currentSession.messages.length === 0) {
        // 如果没有消息，显示提示
        sessionService.addMessage({
          role: 'system',
          content: '⚠️ No messages to rewind to. Start a conversation first.',
        });
        return;
      }
      setShowRewindSelector(true);
    };

    eventBus.on('show_rewind_selector', handleShowRewindSelector);

    return () => {
      eventBus.off('show_rewind_selector', handleShowRewindSelector);
    };
  }, [app, currentSession, sessionService]);

  // 监听resume命令事件
  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleShowResumeSelector = () => {
      const sessions = sessionService.list();
      if (sessions.length === 0) {
        sessionService.addMessage({
          role: 'system',
          content: '📭 No sessions found to resume',
        });
        return;
      }
      setShowResumeSelector(true);
    };

    eventBus.on('show_resume_selector', handleShowResumeSelector);

    return () => {
      eventBus.off('show_resume_selector', handleShowResumeSelector);
    };
  }, [app, sessionService]);

  // 监听MCP管理器事件
  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleShowMcpManager = () => {
      setShowMcpManager(true);
    };

    eventBus.on('show_mcp_manager', handleShowMcpManager);

    return () => {
      eventBus.off('show_mcp_manager', handleShowMcpManager);
    };
  }, [app]);

  // 监听Status管理器事件
  useEffect(() => {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    const handleShowStatusManager = () => {
      setShowStatusManager(true);
    };

    eventBus.on('show_status_manager', handleShowStatusManager);

    return () => {
      eventBus.off('show_status_manager', handleShowStatusManager);
    };
  }, [app]);

  // MCP管理器处理函数
  const handleMcpManagerClose = useCallback(() => {
    setShowMcpManager(false);
  }, []);

  // Status管理器处理函数
  const handleStatusManagerClose = useCallback(() => {
    setShowStatusManager(false);
  }, []);

  const hasTransientOverlay =
    showModelSelector ||
    showRewindSelector ||
    showResumeSelector ||
    showMcpManager ||
    showStatusManager;
  const inputIsHidden = transcriptMode || hasTransientOverlay;
  const inputIsDisabled = inputIsHidden || Boolean(pendingApproval);
  const inputDisabledHint = pendingApproval
    ? 'Approval pending: press a to approve, d to deny, or Esc to deny'
    : 'Agent is working • Ctrl+C to stop or exit';

  return (
    <Box flexDirection="column">
      {/* 模型选择器模态 - 完全覆盖屏幕 */}
      {showModelSelector ? (
        <ModelSelector
          models={[
            {
              id: 'deepseek-chat',
              name: 'DeepSeek V3.2',
              provider: 'DeepSeek',
              description: 'Advanced reasoning and coding model',
            },
            {
              id: 'deepseek-reasoner',
              name: 'DeepSeek-R1-0528',
              provider: 'DeepSeek',
              description: 'Specialized reasoning model',
            },
            {
              id: 'claude-3-5-sonnet',
              name: 'Claude 3.5 Sonnet',
              provider: 'Anthropic',
              description: 'Balanced performance and capability',
            },
            {
              id: 'gpt-4o',
              name: 'GPT-4o',
              provider: 'OpenAI',
              description: 'Multimodal flagship model',
            },
            {
              id: 'gpt-4o-mini',
              name: 'GPT-4o Mini',
              provider: 'OpenAI',
              description: 'Fast and cost-effective model',
            },
          ]}
          currentModelId={currentModelId}
          onSelect={handleModelSelect}
          onClose={handleModelSelectorClose}
        />
      ) : showRewindSelector ? (
        <RewindSelector
          messages={(currentSession?.messages as EnhancedMessage[]) || []}
          onSelect={handleRewindSelect}
          onClose={handleRewindSelectorClose}
        />
      ) : showResumeSelector ? (
        <ResumeSelector
          sessions={sessionService.list()}
          onSelect={handleResumeSelect}
          onCancel={handleResumeSelectorClose}
        />
      ) : showMcpManager ? (
        <MCPManager
          mcpManager={app.getContainer().get('mcpManager')}
          configService={app.getContainer().get('config')}
          onExit={handleMcpManagerClose}
        />
      ) : showStatusManager ? (
        <StatusManager
          statusCollector={app.getContainer().get('statusCollector')}
          onExit={handleStatusManagerClose}
        />
      ) : (
        <>
          <AgentWorkbench
            messages={historyMessages}
            tasks={visibleWorkbenchState.tasks}
            currentTask={visibleWorkbenchState.currentTask}
            status={statusRef.current}
            isLoading={isLoading}
            sessionId={currentSession?.id}
            model={currentModelId}
            project={projectName}
            pendingApproval={pendingApproval}
            runSummaries={runSummaries}
            liveModelOutput={visibleWorkbenchState.liveModelOutput}
            queuedMessages={messageQueue.queuedMessages}
            onRemoveQueuedMessage={messageQueue.remove}
            dynamicMessageStartIndex={dynamicMessageStartIndex}
            inputDraftActive={inputDraftActive}
          />

          {/* 状态栏 - 固定在最底部 */}
          <StatusBar
            model={currentModelId}
            project={projectName}
            progress="100%"
            sessionId={currentSession?.id}
            status={statusRef.current}
          />
        </>
      )}

      {!inputIsHidden && pendingApproval && (
        <Box paddingX={1}>
          <ToolApprovalCard request={pendingApproval} />
        </Box>
      )}

      <Box paddingX={1} paddingBottom={1} display={inputIsHidden ? 'none' : 'flex'}>
        <SimpleInput
          onSubmit={handleSubmit}
          onDraftChange={handleInputDraftChange}
          placeholder='Type your message or "/" for commands'
          disabled={inputIsDisabled}
          hidden={inputIsHidden}
          width={terminalWidth}
          disabledHint={inputDisabledHint}
        />
      </Box>
    </Box>
  );
}

/**
 * App 组件
 *
 * 主入口组件,提供全局状态和主题
 */
export function App({ app }: AppProps) {
  return (
    <ThemeProvider>
      <AppContextProvider app={app}>
        <AppContent />
      </AppContextProvider>
    </ThemeProvider>
  );
}
