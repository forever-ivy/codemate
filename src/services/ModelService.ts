import { createOpenAI } from '@ai-sdk/openai';
import { type ToolSet, generateText, tool } from 'ai';
import type { AgentRuntimeEvent } from '../agents/AgentRuntimeEvent';
import type { Container } from '../application/Container';
import { ContextResolver } from '../context/ContextResolver';
import { FileProvider } from '../context/providers/FileProvider';
import { FolderProvider } from '../context/providers/FolderProvider';
import { GitProvider } from '../context/providers/GitProvider';
import { ProblemsProvider } from '../context/providers/ProblemsProvider';
import { TerminalProvider } from '../context/providers/TerminalProvider';
import type { ToolManager } from '../managers/ToolManager';
import { ModelProviderFactory } from '../models/ModelProviderFactory';
import { StreamingAgentRuntime } from '../models/StreamingAgentRuntime';
import type { OutputStyle } from '../styles/base/OutputStyle';
import type { OutputStyleManager } from '../styles/managers/OutputStyleManager';
import type { Tool } from '../tools/base/Tool';
import type { AIResponse, Message, ModelConfig } from '../types/index';
import { writeDebugLog } from '../utils/debugConsole';
import { logger } from '../utils/logger';
import type { EventBus } from './EventBus';
import type { Paths } from './Paths';

/**
 * ModelService 配置
 */
export interface ModelServiceConfig extends ModelConfig {
  container: Container;
  paths: Paths;
}

interface TokenUsageLike {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// 任务跟踪事件
export interface TaskEvent {
  type: 'task_started' | 'task_completed' | 'task_failed' | 'tool_called' | 'planning';
  taskId: string;
  description: string;
  details?: unknown;
  timestamp: number;
}

export interface ChatWithToolsOptions {
  runId?: string;
  onRuntimeEvent?: (event: AgentRuntimeEvent) => void;
  onStreamEvent?: (event: ModelStreamEvent) => void;
  abortSignal?: AbortSignal;
  enablePlanningStep?: boolean;
}

export interface ModelStreamEvent {
  runId: string;
  kind: 'reasoning' | 'text' | 'tool';
  delta: string;
  timestamp: number;
}

export interface ModelServiceRuntimeDependencies {
  providerFactory?: Pick<ModelProviderFactory, 'create'>;
  streamingRuntime?: Pick<StreamingAgentRuntime, 'execute'>;
}

/**
 * AI 模型服务（使用 AI SDK）
 *
 * 职责：
 * 1. 管理 AI API 连接
 * 2. 发送消息并获取回复
 * 3. 处理 Function Calling
 * 4. 管理输出样式
 *
 * 改进：
 * - 使用 AI SDK 简化代码
 * - 自动处理工具调用循环
 * - 更好的类型安全
 * - 支持输出样式管理
 */
export class ModelService {
  // AI SDK provider
  private provider: ReturnType<typeof createOpenAI>;

  // 模型配置
  private config: ModelConfig;

  // OutputStyleManager
  private outputStyleManager: OutputStyleManager;
  private currentOutputStyle?: OutputStyle;

  // ContextResolver
  private contextResolver: ContextResolver;
  private cwd: string;

  // EventBus for task tracking
  private eventBus: EventBus;

  private providerFactory: Pick<ModelProviderFactory, 'create'>;
  private streamingRuntime: Pick<StreamingAgentRuntime, 'execute'>;

  /**
   * 构造函数
   *
   * @param config 模型配置
   */
  constructor(config: ModelServiceConfig, dependencies: ModelServiceRuntimeDependencies = {}) {
    this.config = config;
    this.cwd = config.paths.getCwd();
    this.eventBus = config.container.get<EventBus>('eventBus');
    this.providerFactory = dependencies.providerFactory ?? new ModelProviderFactory();
    this.streamingRuntime = dependencies.streamingRuntime ?? new StreamingAgentRuntime();

    // 创建 DeepSeek provider（兼容 OpenAI API）
    this.provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    // 初始化 OutputStyleManager
    this.outputStyleManager = config.container.getOutputStyleManager();

    // 初始化上下文解析器
    this.contextResolver = new ContextResolver();

    // 注册内置 Provider
    this.contextResolver.register(new ProblemsProvider());
    this.contextResolver.register(new TerminalProvider());
    this.contextResolver.register(new GitProvider());
    this.contextResolver.register(new FileProvider());
    this.contextResolver.register(new FolderProvider());

    logger.info(`✅ ModelService initialized (model: ${config.model})`);
  }

  /**
   * 发送单条消息并获取回复
   *
   * @param content 消息内容
   * @returns AI 回复
   *
   * 使用 AI SDK 的 generateText 方法
   */
  async chat(content: string): Promise<AIResponse> {
    logger.debug(`📤 Sending message: ${content}`);

    try {
      // 解析上下文引用
      const resolvedContent = await this.contextResolver.resolve(content, this.cwd);

      // 使用 AI SDK 生成文本
      const result = await generateText({
        model: this.provider(this.config.model),
        system: this.buildSystemPrompt(),
        prompt: resolvedContent,
        temperature: this.config.temperature ?? 0.7,
        // 注意：AI SDK 不使用 maxTokens 参数
        // Token 限制通过 model 配置或其他方式控制
      });

      logger.debug(`📥 Received reply: ${result.text.substring(0, 50)}...`);

      const usage = result.usage as TokenUsageLike | undefined;

      // 返回格式化的响应
      return {
        content: result.text,
        model: this.config.model,
        usage: usage
          ? {
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('❌ AI API error:', error);

      if (error instanceof Error) {
        throw new Error(`AI API failed: ${error.message}`);
      }
      throw new Error('AI API failed: Unknown error');
    }
  }

  /**
   * 生成文本内容（直接返回文本）
   *
   * @param prompt 提示词
   * @returns 生成的文本
   */
  async generateText(prompt: string): Promise<string> {
    logger.debug(`📤 Generating text: ${prompt.substring(0, 50)}...`);

    try {
      const resolvedPrompt = await this.contextResolver.resolve(prompt, this.cwd);
      const result = await generateText({
        model: this.provider(this.config.model),
        system: this.buildSystemPrompt(),
        prompt: resolvedPrompt,
        temperature: this.config.temperature ?? 0.7,
      });

      return result.text;
    } catch (error) {
      logger.error('❌ AI API error:', error);

      if (error instanceof Error) {
        throw new Error(`AI API failed: ${error.message}`);
      }
      throw new Error('AI API failed: Unknown error');
    }
  }

  /**
   * 发送多条消息并获取回复
   *
   * @param messages 消息列表
   * @returns AI 回复
   *
   * 使用 AI SDK 的 messages 参数
   */
  async chatWithMessages(messages: Message[]): Promise<AIResponse> {
    logger.debug(`📤 Sending ${messages.length} messages`);

    try {
      // 解析最后一条用户消息中的上下文引用
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        const resolvedContent = await this.contextResolver.resolve(
          lastMessage.content as string,
          this.cwd
        );
        lastMessage.content = resolvedContent;
      }

      // 转换消息格式
      const aiMessages = messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // 使用 AI SDK 生成文本
      const result = await generateText({
        model: this.provider(this.config.model),
        messages: this.withSystemPrompt(aiMessages),
        temperature: this.config.temperature ?? 0.7,
      });

      logger.debug(`📥 Received reply: ${result.text.substring(0, 50)}...`);

      const usage = result.usage as TokenUsageLike | undefined;

      return {
        content: result.text,
        model: this.config.model,
        usage: usage
          ? {
              promptTokens: usage.promptTokens ?? 0,
              completionTokens: usage.completionTokens ?? 0,
              totalTokens: usage.totalTokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('❌ AI API error:', error);

      if (error instanceof Error) {
        throw new Error(`AI API failed: ${error.message}`);
      }
      throw new Error('AI API failed: Unknown error');
    }
  }

  /**
   * 获取当前配置
   *
   * @returns 模型配置
   */
  getConfig(): ModelConfig {
    return { ...this.config };
  }

  /**
   * 更新模型配置
   *
   * @param newConfig 新的模型配置
   */
  updateConfig(newConfig: Partial<ModelConfig>): void {
    // 更新内部配置
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // 如果API相关配置发生变化，重新创建provider
    if (newConfig.apiKey || newConfig.baseURL) {
      this.provider = createOpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });
    }

    console.log(`✅ ModelService config updated (model: ${this.config.model})`);
  }

  /**
   * 设置输出样式
   *
   * @param styleName 样式名称
   */
  setOutputStyle(styleName: string | undefined): void {
    // 使用当前工作目录
    const cwd = process.cwd();
    this.currentOutputStyle = this.outputStyleManager.getOutputStyle(styleName, cwd);
  }

  /**
   * 获取当前输出样式
   *
   * @returns 当前输出样式
   */
  getOutputStyle(): OutputStyle {
    if (!this.currentOutputStyle) {
      this.currentOutputStyle = this.outputStyleManager.getDefaultOutputStyle();
    }
    return this.currentOutputStyle;
  }

  /**
   * 列出所有输出样式
   *
   * @returns 输出样式列表
   */
  listOutputStyles(): OutputStyle[] {
    return this.outputStyleManager.list();
  }

  private buildSystemPrompt(extraInstructions?: string): string {
    const providerName = this.detectProviderName();
    const systemPrompt = [
      '你是 CodeMate AI CLI 的智能代码助手。',
      `当前配置的模型 ID 是 "${this.config.model}"。`,
      `当前配置的模型提供方是 "${providerName}"。`,
      '如果用户询问“你是什么模型”或“你是谁”，必须根据以上当前运行配置回答。',
      '不要声称自己是 Claude、Anthropic、OpenAI、ChatGPT 或其他未在当前配置中出现的模型或提供方。',
      '如果无法从配置中确认真实底层模型，只说明当前 CLI 配置的模型 ID 和提供方，不要编造。',
      '',
      this.buildCodingAgentContractPrompt(),
    ];

    if (extraInstructions?.trim()) {
      systemPrompt.push('', extraInstructions.trim());
    }

    return systemPrompt.join('\n');
  }

  private buildCodingAgentContractPrompt(): string {
    return [
      'Coding agent 工作契约:',
      '- 面对开发类任务时，先探索相关文件和项目结构，再决定修改方案。',
      '- 修改文件前必须先读取目标文件，理解现有风格、依赖和边界。',
      '- 修改后必须运行合适的验证，例如 typecheck、test、lint 或 build；如果无法运行，要说明原因。',
      '- 没有真实文件改动时，不要声称已完成开发任务；如果任务未完成，必须明确说明 incomplete 和阻塞原因。',
      '- 最终回答必须包含改动文件、验证结果，以及必要的未完成原因或风险。',
      '- 保持企业级工程习惯：小范围修改、尊重现有模式、不编造执行结果。',
    ].join('\n');
  }

  private buildToolWorkflowPrompt(): string {
    return [
      `当前工作目录: ${process.cwd()}`,
      '',
      'Coding agent 执行流程:',
      '理解需求 -> 探索文件 -> 读取目标文件 -> 修改文件 -> 运行验证 -> 总结结果',
      '',
      '路径规则:',
      '1. 所有文件路径都是相对于当前工作目录的相对路径',
      '2. 使用 "src/utils/file.ts" 而不是 "项目名/src/utils/file.ts"',
      '3. 永远不要在路径中包含项目名称',
      '',
      '工具使用:',
      '- 优先用 grep、glob、list_files 定位入口和相关文件',
      '- 用 read_file 读取文件内容',
      '- 编辑现有文件前必须先调用 read_file',
      '- 优先用 apply_patch 精确修改现有文件；必要时再用 edit_file、edit_code 或 write_file',
      '- 用 bash 执行验证命令',
      '',
      '完成契约:',
      '- 先完成任务，再回复用户',
      '- 连续调用工具完成任务，不要只描述计划',
      '- 开发任务完成前必须运行合适验证',
      '- 如果没有改动文件，必须说明 incomplete，不能说已经完成代码修改',
      '- 最终回答要简洁说明改动文件、验证结果和剩余风险',
      '',
      '代码编写规范:',
      '- TypeScript 文件使用 .ts 扩展名',
      '- 只创建用户要求或任务必需的文件',
      '- 不要自动生成测试文件，除非用户明确要求或本任务需要回归测试',
      '- 不要自动编译或转换文件',
      '- 保持代码简洁清晰',
    ].join('\n');
  }

  private withSystemPrompt(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    const systemPrompt = this.buildSystemPrompt();
    const firstMessage = messages[0];

    if (firstMessage?.role === 'system') {
      return [
        {
          ...firstMessage,
          content: `${systemPrompt}\n\n${firstMessage.content}`,
        },
        ...messages.slice(1),
      ];
    }

    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ];
  }

  private detectProviderName(): string {
    const baseURL = this.config.baseURL.toLowerCase();
    const model = this.config.model.toLowerCase();

    if (baseURL.includes('deepseek') || model.includes('deepseek')) {
      return 'DeepSeek';
    }
    if (baseURL.includes('openrouter') || model.includes('/')) {
      return 'OpenRouter';
    }
    if (baseURL.includes('anthropic') || model.includes('claude')) {
      return 'Anthropic';
    }
    if (baseURL.includes('openai') || model.includes('gpt')) {
      return 'OpenAI';
    }

    return 'custom OpenAI-compatible provider';
  }

  /**
   * 带工具的对话（使用 AI SDK）
   *
   * 这是 Function Calling 的核心方法！
   *
   * @param userMessage 用户消息
   * @param tools 可用的工具列表
   * @returns AI 的最终回复
   *
   * 改进：
   * - 使用 AI SDK 自动处理工具调用循环
   * - 代码更简洁（从 100+ 行减少到 50 行）
   * - 更好的类型安全
   */
  async chatWithTools(
    userMessage: string,
    tools: Tool[],
    toolManager: ToolManager,
    options: ChatWithToolsOptions = {}
  ): Promise<AIResponse> {
    const sessionId = `task-${Date.now()}`;
    const runId = options.runId ?? sessionId;
    writeDebugLog('[model-service] chatWithTools input', {
      model: this.config.model,
      toolCount: tools.length,
      hasMemorySafety: userMessage.includes('Memory safety:'),
      hasRetrievedMemory: userMessage.includes('## Retrieved Memory'),
      hasUserPreferences: userMessage.includes('## User Preferences'),
      hasProjectInstructions: userMessage.includes('## Project Instructions'),
      hasProjectMemory: userMessage.includes('## Project Memory'),
      hasSessionMemory: userMessage.includes('## Session Memory'),
      hasRepositoryContext: userMessage.includes('## Repository Context'),
      hasRepositoryIndex: userMessage.includes('Repository index:'),
      hasGitChanges: userMessage.includes('Git changes:'),
      hasCodeGraph: userMessage.includes('Code graph:'),
      hasSemanticIndex: userMessage.includes('Semantic index:'),
      hasContextBudget: userMessage.includes('Context budget:'),
      hasContextReferences: userMessage.includes('Context references:'),
      hasCompressedContext: userMessage.includes('Compressed context summaries:'),
      hasVerificationContext: userMessage.includes('Verification-driven repository context:'),
      hasRelevantFileContents: userMessage.includes('Relevant file contents:'),
      messagePreview: userMessage.slice(0, 160),
    });

    // 发送规划开始事件
    this.eventBus.emit('task_event', {
      type: 'planning',
      taskId: sessionId,
      description: 'Analyzing request and creating execution plan...',
      timestamp: Date.now(),
    } as TaskEvent);

    try {
      const descriptor = this.providerFactory.create(this.config);
      const onRuntimeEvent = this.createRuntimeEventForwarder(options);

      // 1. 可选规划步骤。默认关闭，避免每次任务额外多一次 LLM 往返。
      if (options.enablePlanningStep ?? false) {
        const planningPrompt = `分析以下用户请求，制定详细的执行计划。只需要列出计划步骤，不要执行任何操作。

用户请求: ${userMessage}

请按以下格式回复计划：
PLAN:
1. [具体步骤描述]
2. [具体步骤描述]
3. [具体步骤描述]
...

然后说 "EXECUTE_PLAN" 表示开始执行。`;

        const planResult = await generateText({
          model: descriptor.model,
          system: this.buildSystemPrompt(),
          prompt: planningPrompt,
          temperature: 0.3, // 降低温度确保计划更稳定
        });

        // 解析计划步骤
        const planSteps = this.extractPlanSteps(planResult.text);

        // 发送计划步骤事件 - 每个步骤都作为一个可跟踪的任务
        planSteps.forEach((step, index) => {
          this.eventBus.emit('task_event', {
            type: 'task_started',
            taskId: `${sessionId}-plan-${index}`,
            description: step,
            timestamp: Date.now(),
          } as TaskEvent);
        });
      }

      // 2. 转换工具为 AI SDK 格式
      const aiTools: ToolSet = {};

      for (const t of tools) {
        aiTools[t.name] = tool({
          description: t.description,
          inputSchema: t.schema,
          execute: async (args: unknown, context) => {
            const toolStartedAt = Date.now();
            const description = `${this.getToolDisplayName(t.name)}: ${this.getToolDescription(t.name, args)}`;

            // 发送工具调用事件
            this.eventBus.emit('task_event', {
              type: 'tool_called',
              taskId: `${sessionId}-${t.name}`,
              description,
              details: { tool: t.name, args },
              timestamp: toolStartedAt,
            } as TaskEvent);

            try {
              const toolResult = await toolManager.executeWithResult(t.name, args, {
                toolCallId: context.toolCallId,
              });
              writeDebugLog('[model-service] tool result', {
                toolName: t.name,
                ok: toolResult.ok,
                durationMs: toolResult.durationMs,
                executionDurationMs: toolResult.executionDurationMs,
                sandboxStatus: toolResult.sandbox?.status,
                sandboxCategory: toolResult.sandbox?.category,
                errorMessage: toolResult.ok ? undefined : toolResult.error.message,
              });

              if (!toolResult.ok) {
                throw new Error(toolResult.error.message);
              }

              // 发送工具完成事件
              this.eventBus.emit('task_event', {
                type: 'task_completed',
                taskId: `${sessionId}-${t.name}`,
                description: `${this.getToolDisplayName(t.name)} completed`,
                details: { success: true },
                timestamp: Date.now(),
              } as TaskEvent);

              return toolResult.output;
            } catch (error) {
              // 发送工具失败事件
              this.eventBus.emit('task_event', {
                type: 'task_failed',
                taskId: `${sessionId}-${t.name}`,
                description: `${this.getToolDisplayName(t.name)} failed`,
                details: { error: error instanceof Error ? error.message : 'Unknown error' },
                timestamp: Date.now(),
              } as TaskEvent);

              throw error;
            }
          },
        });
      }

      // 3. 构建系统提示词，让工具调用路径和最终回答遵循同一套完成契约。
      const systemPrompt = this.buildSystemPrompt(this.buildToolWorkflowPrompt());

      // 4. 委托给 provider-neutral 流式运行时
      const runtimeResult = await this.streamingRuntime.execute({
        runId,
        descriptor,
        system: systemPrompt,
        prompt: userMessage,
        tools: aiTools,
        abortSignal: options.abortSignal,
        onEvent: onRuntimeEvent,
      });

      // 发送任务完成事件
      this.eventBus.emit('task_event', {
        type: 'task_completed',
        taskId: sessionId,
        description: 'All tasks completed successfully',
        timestamp: Date.now(),
      } as TaskEvent);

      // 5. 返回结果
      return {
        content: runtimeResult.text,
        model: descriptor.modelId,
        usage: runtimeResult.usage,
      };
    } catch (error) {
      // 发送任务失败事件
      this.eventBus.emit('task_event', {
        type: 'task_failed',
        taskId: sessionId,
        description: 'Task execution failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
      } as TaskEvent);

      logger.error('❌ AI API error:', error);

      if (error instanceof Error) {
        throw new Error(`AI API failed: ${error.message}`);
      }
      throw new Error('AI API failed: Unknown error');
    }
  }

  /**
   * 从AI回复中提取计划步骤
   */
  private extractPlanSteps(planText: string): string[] {
    const lines = planText.split('\n');
    const steps: string[] = [];

    let inPlanSection = false;
    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'PLAN:' || trimmed.startsWith('PLAN:')) {
        inPlanSection = true;
        continue;
      }

      if (trimmed === 'EXECUTE_PLAN' || inPlanSection === false) {
        break;
      }

      if (inPlanSection && trimmed) {
        // 匹配 "1. 步骤描述" 格式
        const match = trimmed.match(/^\d+\.\s*(.+)$/);
        if (match) {
          steps.push(match[1]);
        }
      }
    }

    // 如果没有找到格式化的计划，返回默认步骤
    if (steps.length === 0) {
      return [
        'Analyze the request',
        'Identify required files and operations',
        'Execute the necessary tools',
        'Complete the task',
      ];
    }

    return steps;
  }

  /**
   * 获取工具的显示名称
   */
  private getToolDisplayName(toolName: string): string {
    const displayNames: Record<string, string> = {
      read_file: 'Reading file',
      write_file: 'Writing file',
      edit_file: 'Editing file',
      edit_code: 'Editing code',
      apply_patch: 'Applying patch',
      list_files: 'Listing files',
      grep: 'Searching content',
      bash: 'Running command',
      glob: 'Finding files',
    };
    return displayNames[toolName] || toolName;
  }

  /**
   * 获取工具操作的描述
   */
  private getToolDescription(toolName: string, args: unknown): string {
    const toolArgs = this.asRecord(args);
    switch (toolName) {
      case 'read_file':
        return this.stringArg(toolArgs, 'path', 'file');
      case 'write_file':
        return this.stringArg(toolArgs, 'path', 'file');
      case 'edit_file':
        return this.stringArg(toolArgs, 'path', 'file');
      case 'edit_code':
        return this.stringArg(toolArgs, 'path', 'file');
      case 'apply_patch':
        return 'workspace files';
      case 'list_files':
        return this.stringArg(toolArgs, 'path', '.');
      case 'grep':
        return `"${this.stringArg(toolArgs, 'pattern', '')}" in ${this.stringArg(toolArgs, 'path', '.')}`;
      case 'bash':
        return this.stringArg(toolArgs, 'command', 'command');
      case 'glob':
        return this.stringArg(toolArgs, 'pattern', '*');
      default:
        return JSON.stringify(args);
    }
  }

  private createRuntimeEventForwarder(
    options: ChatWithToolsOptions
  ): ((event: AgentRuntimeEvent) => void) | undefined {
    if (!options.onRuntimeEvent && !options.onStreamEvent) {
      return undefined;
    }

    return (event: AgentRuntimeEvent) => {
      options.onRuntimeEvent?.(event);
      const streamEvent = this.toModelStreamEvent(event);
      if (streamEvent) {
        options.onStreamEvent?.(streamEvent);
      }
    };
  }

  private toModelStreamEvent(event: AgentRuntimeEvent): ModelStreamEvent | undefined {
    switch (event.type) {
      case 'reasoning_delta':
        return {
          runId: event.runId,
          kind: 'reasoning',
          delta: event.delta,
          timestamp: event.timestamp,
        };
      case 'text_delta':
        return {
          runId: event.runId,
          kind: 'text',
          delta: event.delta,
          timestamp: event.timestamp,
        };
      case 'tool_started':
      case 'tool_input_delta':
        return {
          runId: event.runId,
          kind: 'tool',
          delta: event.toolName,
          timestamp: event.timestamp,
        };
      default:
        return undefined;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private stringArg(args: Record<string, unknown>, key: string, fallback: string): string {
    const value = args[key];
    return typeof value === 'string' && value.length > 0 ? value : fallback;
  }
}
