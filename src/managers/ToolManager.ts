import type { Container } from '../application/Container';
import type { EventBus } from '../services/EventBus';
import { type FileChangeRecord, FileChangeTracker } from '../tools/FileChangeTracker';
import { FileSafetyPolicy } from '../tools/FileSafetyPolicy';
import { type ToolApprovalDecision, ToolApprovalPolicy } from '../tools/ToolApprovalPolicy';
import {
  type ToolApprovalRequest,
  ToolApprovalRequestService,
  type ToolApprovalResponse,
} from '../tools/ToolApprovalRequestService';
import { type ToolSandboxDecision, ToolSandboxPolicy } from '../tools/ToolSandboxPolicy';
import type { ToolTraceService } from '../tools/ToolTraceService';
import type { Tool } from '../tools/base/Tool';
import type { ApprovalMode } from '../types/index';
import { EventType } from '../types/index';
import type { PluginManager } from './PluginManager'; // 新增

export interface ToolSchemaDescriptor {
  // 工具唯一名称，后续会直接传给模型 function/tool calling。
  name: string;
  // 给模型看的能力说明，用来判断什么时候该调用这个工具。
  description: string;
  // 标准 JSON Schema 输入契约，来自工具自己的 Zod schema。
  inputSchema: Record<string, unknown>;
  // 可选来源信息。MCP / plugin 工具可以用它声明 provider、server、远端工具名等。
  metadata?: Record<string, unknown>;
}

export interface StandardToolError {
  // 对模型、日志和评测都可读的错误信息。
  message: string;
  // 保留 Error.name，方便后续 trace 或评测按错误类型聚合。
  name?: string;
}

export interface ToolExecutionContext {
  toolCallId?: string;
}

export type StandardToolResult =
  | {
      // 成功结果使用 ok: true，调用方可以不用 try/catch 判断分支。
      ok: true;
      toolName: string;
      input: unknown;
      output: unknown;
      sandbox?: ToolSandboxDecision;
      // 端到端耗时，包含审批等待、预览生成和真实工具执行。
      durationMs: number;
      // 真实工具执行耗时，不包含用户审批等待。终端 UI 用它避免把等待确认误报成工具很慢。
      executionDurationMs: number;
      // 调用开始时间戳，方便和 AgentLoop、ModelService 日志对齐。
      timestamp: number;
      // 可选运行时上下文，用于保留 toolCallId 等流式执行关联信息。
      executionContext?: ToolExecutionContext;
    }
  | {
      // 失败结果不再抛出异常，而是把错误放进标准信封。
      ok: false;
      toolName: string;
      input: unknown;
      sandbox?: ToolSandboxDecision;
      error: StandardToolError;
      durationMs: number;
      executionDurationMs: number;
      timestamp: number;
      executionContext?: ToolExecutionContext;
    };

class ToolExecutionFailure extends Error {
  constructor(
    message: string,
    readonly sandbox?: ToolSandboxDecision,
    readonly approvalWaitMs = 0
  ) {
    super(message);
    this.name = 'ToolExecutionFailure';
  }
}

/**
 * 工具管理器
 *
 * 职责：
 * 1. 注册工具
 * 2. 查找工具
 * 3. 执行工具
 * 4. 列出所有工具
 *
 * 为什么需要 ToolManager？
 * - 集中管理所有工具
 * - 统一的执行接口
 * - 易于扩展和维护
 */
export class ToolManager {
  /**
   * 工具存储
   *
   * 使用 Map 存储：
   * - key: 工具名称
   * - value: 工具实例
   */
  private tools = new Map<string, Tool>();
  private eventBus?: EventBus; // 新增（可选）
  private pluginManager?: PluginManager; // 新增
  private container?: Container; // 🔥 新增
  private approvalPolicy = new ToolApprovalPolicy();
  private approvalRequestService = new ToolApprovalRequestService();
  private sandboxPolicy = new ToolSandboxPolicy();
  private fileSafetyPolicy = new FileSafetyPolicy();
  private fileChangeTracker = new FileChangeTracker();
  private toolTraceService?: ToolTraceService;

  setApprovalMode(mode: ApprovalMode): void {
    this.approvalPolicy.setMode(mode);
  }

  getApprovalMode(): ApprovalMode {
    return this.approvalPolicy.getMode();
  }

  /**
   * 🔥 新增：设置 Container
   */
  setContainer(container: Container): void {
    this.container = container;

    // 为所有已注册的工具设置 Container
    for (const tool of this.tools.values()) {
      tool.setContainer(container);
    }
  }

  /**
   * 设置插件管理器
   *
   * @param pluginManager PluginManager 实例
   */
  setPluginManager(pluginManager: PluginManager): void {
    this.pluginManager = pluginManager;
    console.log('✅ PluginManager set for ToolManager');
  }

  /**
   * 设置 EventBus
   *
   * @param eventBus EventBus 实例
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    eventBus.on('tool_approval_response', (response: ToolApprovalResponse) => {
      this.approvalRequestService.resolveResponse(response);
    });
    console.log('✅ EventBus set for ToolManager');
  }

  setToolTraceService(toolTraceService: ToolTraceService): void {
    this.toolTraceService = toolTraceService;
  }

  /**
   * 注册工具
   *
   * @param tool 工具实例
   * @throws 如果工具名称已存在
   *
   * 为什么要检查重复？
   * - 避免覆盖已有工具
   * - 确保工具名称唯一
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    // 🔥 新增：如果 Container 已设置，注入到工具
    if (this.container) {
      tool.setContainer(this.container);
    }

    this.tools.set(tool.name, tool);
    console.log(`✅ Registered tool: ${tool.name}`);
  }

  /**
   * 获取工具
   *
   * @param name 工具名称
   * @returns 工具实例，如果不存在返回 undefined
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   *
   * @param name 工具名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 执行工具
   *
   * @param name 工具名称
   * @param input 工具输入（未验证）
   * @returns 工具执行结果
   * @throws 如果工具不存在或输入无效
   *
   * 执行流程：
   * 1. 查找工具
   * 2. 验证输入
   * 3. 执行工具
   * 4. 返回结果
   */
  // biome-ignore lint/suspicious/noExplicitAny: execute() is the legacy raw-result path; executeWithResult() adds the typed standard envelope.
  async execute(name: string, input: unknown): Promise<any> {
    const { output } = await this.executeCore(name, input);
    return output;
  }

  private async executeCore(
    name: string,
    input: unknown
  ): Promise<{ output: unknown; sandbox?: ToolSandboxDecision; approvalWaitMs: number }> {
    // 1. 查找工具
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    let sandbox: ToolSandboxDecision | undefined;
    let approvalWaitMs = 0;

    try {
      const cwd = this.getWorkspaceCwd();
      sandbox = this.sandboxPolicy.check(name, input, cwd);
      this.emitSandboxDecision(name, input, sandbox);

      if (sandbox.status === 'deny') {
        throw new Error(`Tool denied by sandbox policy: ${sandbox.reason}`);
      }

      const approval = this.approvalPolicy.decide(name, input);
      this.emitApprovalDecision(name, input, approval);

      if (approval.status === 'deny') {
        throw new Error(`Tool denied by approval policy: ${approval.reason}`);
      }

      if (approval.status === 'requires_approval') {
        const request = await this.approvalRequestService.createRequest(
          name,
          input,
          approval,
          cwd,
          sandbox
        );
        const responsePromise = this.approvalRequestService.waitForResponse(request.id);
        this.emitApprovalRequest(request);
        const approvalStartedAt = Date.now();
        const response = await responsePromise;
        approvalWaitMs += Date.now() - approvalStartedAt;
        if (!response.approved) {
          throw new Error(
            `Tool approval denied: ${response.reason ?? 'User denied the tool request.'}`
          );
        }
      }

      // 🔥 新增：触发 onToolBefore 钩子
      if (this.pluginManager) {
        await this.pluginManager.triggerToolBefore(tool, input);
      }
      // 🔥 发出 before 事件
      if (this.eventBus) {
        this.eventBus.emit(EventType.TOOL_BEFORE, {
          name,
          input,
          timestamp: Date.now(),
        });
      }
      // 2. 验证输入
      const validInput = tool.validate(input);

      const fileSafety = this.fileSafetyPolicy.check(name, validInput, cwd);
      if (!fileSafety.allowed) {
        throw new Error(`Unsafe file operation: ${fileSafety.reason}`);
      }

      const changeSnapshots = await this.fileChangeTracker.captureBeforeMany(name, validInput, cwd);

      // 3. 执行工具
      const result = await tool.execute(validInput);

      for (const changeSnapshot of changeSnapshots) {
        const change = await this.fileChangeTracker.captureAfter(changeSnapshot);
        this.emitFileChange(change);
      }

      // 🔥 新增：触发 onToolAfter 钩子
      if (this.pluginManager) {
        await this.pluginManager.triggerToolAfter(tool, result);
      }
      // 🔥 发出 after 事件
      if (this.eventBus) {
        this.eventBus.emit(EventType.TOOL_AFTER, {
          name,
          result,
          timestamp: Date.now(),
        });
      }
      return {
        output: result,
        sandbox,
        approvalWaitMs,
      };
    } catch (error) {
      console.error(`❌ Tool execution failed: ${name}`, error);

      // 🔥 新增：即使工具执行失败，也触发 onToolAfter
      if (this.pluginManager) {
        await this.pluginManager.triggerToolAfter(tool, { error });
      }
      // 🔥 发出 error 事件
      if (this.eventBus) {
        this.eventBus.emit(EventType.TOOL_ERROR, {
          name,
          error: error instanceof Error ? error : new Error(String(error)),
          timestamp: Date.now(),
        });
      }

      if (error instanceof Error) {
        throw new ToolExecutionFailure(
          `Tool execution failed (${name}): ${error.message}`,
          sandbox,
          approvalWaitMs
        );
      }
      throw new ToolExecutionFailure(
        `Tool execution failed (${name}): Unknown error`,
        sandbox,
        approvalWaitMs
      );
    }
  }

  /**
   * 以标准信封格式执行工具。
   *
   * 旧的 execute() 仍然返回工具原始结果，供现有模型调用链使用。
   * executeWithResult() 面向日志、回放、评测和后续 Tool Trace。
   */
  async executeWithResult(
    name: string,
    input: unknown,
    executionContext?: ToolExecutionContext
  ): Promise<StandardToolResult> {
    const startedAt = Date.now();

    try {
      const { output, sandbox, approvalWaitMs } = await this.executeCore(name, input);
      const durationMs = Date.now() - startedAt;
      const result: StandardToolResult = {
        ok: true,
        toolName: name,
        input,
        output,
        sandbox,
        durationMs,
        executionDurationMs: Math.max(0, durationMs - approvalWaitMs),
        timestamp: startedAt,
        executionContext,
      };
      this.toolTraceService?.record(result);
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const approvalWaitMs = error instanceof ToolExecutionFailure ? error.approvalWaitMs : 0;
      const result: StandardToolResult = {
        ok: false,
        toolName: name,
        input,
        sandbox: error instanceof ToolExecutionFailure ? error.sandbox : undefined,
        error: this.normalizeToolError(error),
        durationMs,
        executionDurationMs: Math.max(0, durationMs - approvalWaitMs),
        timestamp: startedAt,
        executionContext,
      };
      this.toolTraceService?.record(result);
      return result;
    }
  }

  private emitSandboxDecision(name: string, input: unknown, sandbox: ToolSandboxDecision): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.emit('tool_sandbox_decision', {
      name,
      input,
      sandbox,
      timestamp: Date.now(),
    });
  }

  private emitApprovalDecision(name: string, input: unknown, approval: ToolApprovalDecision): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.emit('tool_approval_decision', {
      name,
      input,
      approval,
      timestamp: Date.now(),
    });
  }

  private emitApprovalRequest(request: ToolApprovalRequest): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.emit('tool_approval_request', request);
  }

  private emitFileChange(change: FileChangeRecord): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.emit('file_change', {
      change,
      timestamp: Date.now(),
    });
  }

  private getWorkspaceCwd(): string {
    try {
      return this.container?.get<{ getCwd(): string }>('paths').getCwd() ?? process.cwd();
    } catch {
      return process.cwd();
    }
  }

  /**
   * 列出所有工具
   *
   * @returns 工具名称数组
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具的信息
   *
   * @returns 工具信息数组
   *
   * 主要用于：
   * - 调试
   * - 生成工具列表
   * - 传递给 AI（让 AI 知道有哪些工具）
   */
  getAllInfo(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((tool) => tool.getInfo());
  }

  /**
   * 获取标准化工具 Schema。
   *
   * 这个方法把工具名称、描述和输入 JSON Schema 放在统一结构里。
   * 后续模型适配、MCP 暴露和评测回放都可以使用同一份契约描述。
   */
  getToolSchemas(): ToolSchemaDescriptor[] {
    return Array.from(this.tools.values()).map((tool) => {
      const metadata = this.getToolMetadata(tool);
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.getJsonSchema(),
        ...(metadata ? { metadata } : {}),
      };
    });
  }

  /**
   * 获取工具数量
   *
   * @returns 工具数量
   */
  count(): number {
    return this.tools.size;
  }

  private normalizeToolError(error: unknown): StandardToolError {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      message: String(error),
    };
  }

  private getToolMetadata(tool: Tool): Record<string, unknown> | undefined {
    if (!('metadata' in tool)) {
      return undefined;
    }

    const metadata = (tool as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    return metadata as Record<string, unknown>;
  }
}
