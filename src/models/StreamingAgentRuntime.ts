import { stepCountIs, streamText, type ToolSet } from 'ai';
import { createAgentRuntimeEvent, type AgentRuntimeEvent } from '../agents/AgentRuntimeEvent';
import type { ProviderModelDescriptor } from './ModelProviderFactory';
import { formatToolActivityTitle } from './ToolActivityFormatter';

export interface StreamingAgentRuntimeInput {
  runId: string;
  descriptor: ProviderModelDescriptor;
  system: string;
  prompt: string;
  tools: ToolSet;
  abortSignal?: AbortSignal;
  onEvent?: (event: AgentRuntimeEvent) => void;
}

export interface StreamingAgentRuntimeResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ActiveReasoningOperation {
  operationId: string;
  stepId: string;
  startedAt: number;
}

interface ActiveTextOperation {
  operationId: string;
  stepId: string;
  startedAt: number;
}

interface ActiveToolOperation {
  operationId: string;
  stepId: string;
  startedAt: number;
  toolName: string;
  toolCallId: string;
  toolInput?: unknown;
}

interface RuntimeContext {
  input: StreamingAgentRuntimeInput;
  emit: (event: Parameters<typeof createAgentRuntimeEvent>[0]) => void;
  turnId: string;
  stepId: string;
  activeReasoning: Map<string, ActiveReasoningOperation>;
  activeText: Map<string, ActiveTextOperation>;
  activeTools: Map<string, ActiveToolOperation>;
  stepStartedAtById: Map<string, number>;
}

export class StreamingAgentRuntime {
  async execute(input: StreamingAgentRuntimeInput): Promise<StreamingAgentRuntimeResult> {
    const turnId = `${input.runId}:turn:1`;
    const modelOperationId = `${turnId}:model`;
    const startedAt = Date.now();
    let firstOutputAt: number | undefined;
    let stepNumber = 1;
    const activeReasoning = new Map<string, ActiveReasoningOperation>();
    const activeText = new Map<string, ActiveTextOperation>();
    const activeTools = new Map<string, ActiveToolOperation>();
    const stepStartedAtById = new Map<string, number>();
    const emit = (event: Parameters<typeof createAgentRuntimeEvent>[0]) => {
      input.onEvent?.(createAgentRuntimeEvent(event));
    };

    emit({
      runId: input.runId,
      turnId,
      operationId: modelOperationId,
      kind: 'model',
      lifecycle: 'started',
      type: 'model_started',
      description: `Thinking with ${input.descriptor.modelId}`,
      startedAt,
    });

    const result = streamText({
      model: input.descriptor.model,
      system: input.system,
      prompt: input.prompt,
      tools: input.tools,
      stopWhen: stepCountIs(10),
      abortSignal: input.abortSignal,
    });

    try {
      for await (const part of result.fullStream) {
        firstOutputAt ??= Date.now();

        const stepId = `${turnId}:step:${stepNumber}`;
        if (!stepStartedAtById.has(stepId)) {
          stepStartedAtById.set(stepId, Date.now());
        }

        this.emitPart(part, {
          input,
          emit,
          turnId,
          stepId,
          activeReasoning,
          activeText,
          activeTools,
          stepStartedAtById,
        });

        if (this.isFinishStepPart(part)) {
          stepNumber += 1;
        }
      }

      const [text, usage] = await Promise.all([result.text, result.totalUsage]);
      const completedAt = Date.now();

      this.closeActiveOperations({
        input,
        emit,
        turnId,
        activeReasoning,
        activeText,
        activeTools,
        completedAt,
      });

      emit({
        runId: input.runId,
        turnId,
        operationId: modelOperationId,
        kind: 'model',
        lifecycle: 'completed',
        type: 'model_completed',
        description: 'Model execution completed',
        startedAt,
        firstOutputAt,
        completedAt,
      });

      return {
        text,
        usage: usage
          ? {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      const completedAt = Date.now();
      const message = this.getErrorMessage(error);

      this.closeActiveOperations({
        input,
        emit,
        turnId,
        activeReasoning,
        activeText,
        activeTools,
        completedAt,
        errorMessage: message,
      });

      emit({
        runId: input.runId,
        turnId,
        operationId: modelOperationId,
        kind: 'model',
        lifecycle: 'failed',
        type: 'model_failed',
        description: 'Model execution failed',
        startedAt,
        firstOutputAt,
        completedAt,
        error: message,
      });

      if (this.isAbortError(error, input.abortSignal)) {
        emit({
          runId: input.runId,
          turnId,
          operationId: turnId,
          kind: 'run',
          lifecycle: 'cancelled',
          type: 'run_cancelled',
          description: 'Run cancelled',
          startedAt,
          completedAt,
          error: message,
        });
      }

      throw error;
    }
  }

  private emitPart(part: any, context: RuntimeContext): void {
    const {
      input,
      emit,
      turnId,
      stepId,
      activeReasoning,
      activeText,
      activeTools,
      stepStartedAtById,
    } = context;

    switch (part?.type) {
      case 'reasoning-start': {
        const operationId = part.id ?? `${stepId}:reasoning`;
        const startedAt = Date.now();
        activeReasoning.set(operationId, { operationId, stepId, startedAt });
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId,
          kind: 'reasoning',
          lifecycle: 'started',
          type: 'reasoning_started',
          description: 'Thinking',
          startedAt,
          delta: '',
        });
        return;
      }

      case 'reasoning-delta': {
        const operationId = part.id ?? `${stepId}:reasoning`;
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId,
          kind: 'reasoning',
          lifecycle: 'delta',
          type: 'reasoning_delta',
          description: 'Thinking',
          delta: part.text ?? part.delta ?? '',
        });
        return;
      }

      case 'reasoning-end': {
        const operationId = part.id ?? `${stepId}:reasoning`;
        const active = activeReasoning.get(operationId);
        activeReasoning.delete(operationId);
        emit({
          runId: input.runId,
          turnId,
          stepId: active?.stepId ?? stepId,
          operationId,
          kind: 'reasoning',
          lifecycle: 'completed',
          type: 'reasoning_completed',
          description: 'Thinking completed',
          startedAt: active?.startedAt,
          completedAt: Date.now(),
          delta: '',
        });
        return;
      }

      case 'text-start': {
        const operationId = part.id ?? `${stepId}:text`;
        const startedAt = Date.now();
        activeText.set(operationId, { operationId, stepId, startedAt });
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId,
          kind: 'text',
          lifecycle: 'started',
          type: 'text_started',
          description: 'Responding',
          startedAt,
          delta: '',
        });
        return;
      }

      case 'text-delta': {
        const operationId = part.id ?? `${stepId}:text`;
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId,
          kind: 'text',
          lifecycle: 'delta',
          type: 'text_delta',
          description: 'Responding',
          delta: part.text ?? part.delta ?? '',
        });
        return;
      }

      case 'text-end': {
        const operationId = part.id ?? `${stepId}:text`;
        const active = activeText.get(operationId);
        activeText.delete(operationId);
        emit({
          runId: input.runId,
          turnId,
          stepId: active?.stepId ?? stepId,
          operationId,
          kind: 'text',
          lifecycle: 'completed',
          type: 'text_completed',
          description: 'Response completed',
          startedAt: active?.startedAt,
          completedAt: Date.now(),
          delta: '',
        });
        return;
      }

      case 'tool-call': {
        const startedAt = Date.now();
        const toolInput = this.extractToolInput(part);
        const description = formatToolActivityTitle(part.toolName, toolInput);
        activeTools.set(part.toolCallId, {
          operationId: part.toolCallId,
          stepId,
          startedAt,
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          toolInput,
        });
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId: part.toolCallId,
          kind: 'tool',
          lifecycle: 'started',
          type: 'tool_started',
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          toolInput,
          description,
          startedAt,
        });
        return;
      }

      case 'tool-input-delta': {
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId: part.toolCallId,
          kind: 'tool',
          lifecycle: 'delta',
          type: 'tool_input_delta',
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          description: `Preparing ${part.toolName}`,
          delta: part.inputTextDelta ?? part.delta ?? '',
        });
        return;
      }

      case 'tool-result': {
        const active = activeTools.get(part.toolCallId);
        activeTools.delete(part.toolCallId);
        const toolInput = active?.toolInput ?? this.extractToolInput(part);
        emit({
          runId: input.runId,
          turnId,
          stepId: active?.stepId ?? stepId,
          operationId: part.toolCallId,
          kind: 'tool',
          lifecycle: 'completed',
          type: 'tool_completed',
          toolName: part.toolName,
          toolCallId: part.toolCallId,
          toolInput,
          description: formatToolActivityTitle(part.toolName, toolInput),
          startedAt: active?.startedAt,
          completedAt: Date.now(),
        });
        return;
      }

      case 'finish-step': {
        const completedAt = Date.now();
        const stepStartedAt = stepStartedAtById.get(stepId);
        emit({
          runId: input.runId,
          turnId,
          stepId,
          operationId: stepId,
          kind: 'step',
          lifecycle: 'completed',
          type: 'step_completed',
          description: `Step completed: ${part.finishReason ?? 'unknown'}`,
          startedAt: stepStartedAt,
          completedAt,
        });
        stepStartedAtById.delete(stepId);
        return;
      }

      case 'error':
        throw part.error instanceof Error ? part.error : new Error(String(part.error));

      default:
        return;
    }
  }

  private extractToolInput(part: any): unknown {
    return part?.input ?? part?.args ?? part?.toolInput ?? part?.inputJson;
  }

  private closeActiveOperations(input: {
    input: StreamingAgentRuntimeInput;
    emit: (event: Parameters<typeof createAgentRuntimeEvent>[0]) => void;
    turnId: string;
    activeReasoning: Map<string, ActiveReasoningOperation>;
    activeText: Map<string, ActiveTextOperation>;
    activeTools: Map<string, ActiveToolOperation>;
    completedAt: number;
    errorMessage?: string;
  }): void {
    const {
      input: runtimeInput,
      emit,
      turnId,
      activeReasoning,
      activeText,
      activeTools,
      completedAt,
      errorMessage,
    } = input;

    for (const operation of activeReasoning.values()) {
      emit({
        runId: runtimeInput.runId,
        turnId,
        stepId: operation.stepId,
        operationId: operation.operationId,
        kind: 'reasoning',
        lifecycle: 'completed',
        type: 'reasoning_completed',
        description: errorMessage ? 'Thinking interrupted' : 'Thinking completed',
        startedAt: operation.startedAt,
        completedAt,
        delta: '',
      });
    }
    activeReasoning.clear();

    for (const operation of activeText.values()) {
      emit({
        runId: runtimeInput.runId,
        turnId,
        stepId: operation.stepId,
        operationId: operation.operationId,
        kind: 'text',
        lifecycle: 'completed',
        type: 'text_completed',
        description: errorMessage ? 'Response interrupted' : 'Response completed',
        startedAt: operation.startedAt,
        completedAt,
        delta: '',
      });
    }
    activeText.clear();

    for (const operation of activeTools.values()) {
      emit({
        runId: runtimeInput.runId,
        turnId,
        stepId: operation.stepId,
        operationId: operation.operationId,
        kind: 'tool',
        lifecycle: 'failed',
        type: 'tool_failed',
        toolName: operation.toolName,
        toolCallId: operation.toolCallId,
        description: `${operation.toolName} failed`,
        startedAt: operation.startedAt,
        completedAt,
        error: errorMessage ?? 'Tool stream interrupted',
      });
    }
    activeTools.clear();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown provider stream error';
  }

  private isAbortError(error: unknown, abortSignal?: AbortSignal): boolean {
    return Boolean(
      abortSignal?.aborted ||
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof DOMException !== 'undefined' &&
          error instanceof DOMException &&
          error.name === 'AbortError')
    );
  }

  private isFinishStepPart(part: unknown): part is { type: 'finish-step' } {
    return (
      typeof part === 'object' &&
      part !== null &&
      'type' in part &&
      (part as { type?: string }).type === 'finish-step'
    );
  }
}
