import type { ToolManager } from '@/managers/ToolManager';
import type { SessionService } from '@/services/SessionService';
import type { EventBus } from '@/services/EventBus';
/**
 * 基础类型定义
 *
 * 这个文件会随着项目发展不断扩展
 * 现在先定义最基础的类型
 *//**
 * 应用配置
 *
 * 后续会添加更多配置项，如：
 * - apiKey: AI API 密钥
 * - model: 使用的模型
 * - temperature: 温度参数
 */
export interface AppConfig {
  name: string; // 应用名称
  version: string; // 应用版本
}

/**
 * 服务接口
 *
 * 所有服务都应该实现这个接口
 * 这样可以统一管理服务的生命周期
 */
export interface Service {
  name: string; // 服务名称

  // 可选方法：初始化
  // 有些服务需要初始化（如连接数据库）
  initialize?(): Promise<void>;

  // 可选方法：销毁
  // 程序退出时清理资源（如关闭连接）
  destroy?(): Promise<void>;
}

// ============ 第 1 篇新增 ============
/**
 * AI 模型配置
 *
 * 用于配置 AI API 的参数
 */
export interface ModelConfig {
  apiKey: string; // API 密钥
  baseURL: string; // API 地址
  model: string; // 模型名称（如 deepseek-chat）
  temperature?: number; // 温度参数（0-2，越高越随机）
  maxTokens?: number; // 最大 token 数
}

/**
 * 消息角色
 *
 * AI 对话中的角色类型
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * 消息对象
 *
 * AI 对话中的一条消息
 */
export interface Message {
  role: MessageRole; // 角色
  content: string; // 内容
}

/**
 * AI 响应
 *
 * AI API 返回的响应
 */
export interface AIResponse {
  content: string; // AI 回复的内容
  model: string; // 使用的模型
  usage?: {
    // Token 使用情况（可选）
    promptTokens: number; // 输入 token 数
    completionTokens: number; // 输出 token 数
    totalTokens: number; // 总 token 数
  };
}

// ============ 第 2 篇新增 ============
/**
 * 工具执行结果
 *
 * 工具执行后返回的标准格式
 */
export interface ToolResult<T = any> {
  success: boolean; // 是否成功
  data?: T; // 结果数据
  error?: string; // 错误信息
}

/**
 * 工具信息
 *
 * 工具的元数据
 */
export interface ToolInfo {
  name: string; // 工具名称
  description: string; // 工具描述
}

// ============ 第 8 篇新增 ============
/**
 * 应用配置
 *
 * 应用级别的配置项
 */
export interface AppConfig {
  name: string; // 应用名称
  version: string; // 应用版本
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // 日志级别
  workDir: string; // 工作目录
}

/**
 * 工具配置
 *
 * 工具系统的配置项
 */
export interface ToolConfig {
  enabled: string[]; // 启用的工具列表
  permissions?: Record<string, string[]>; // 工具权限（可选）
}

/**
 * UI 配置
 *
 * 用户界面的配置项
 */
export interface UIConfig {
  theme: 'dark' | 'light'; // 主题
  showTimestamp: boolean; // 是否显示时间戳
}

/**
 * 性能优化配置
 */
export interface PerformanceConfig {
  compression: {
    enabled: boolean;
    triggerRatio: number;
    protectThreshold: number;
    minimumPrune: number;
    protectedTools: string[];
    protectTurns: number;
  };
}

/**
 * 完整配置
 *
 * 包含所有配置项的完整配置对象
 */
export interface Config {
  app: AppConfig; // 应用配置
  model: ModelConfig; // 模型配置
  tools: ToolConfig; // 工具配置
  ui: UIConfig; // UI 配置
  performance?: PerformanceConfig; // 性能配置（可选）
}

/**
 * 配置选项
 *
 * 用于创建 ConfigService 的选项
 */
export interface ConfigOptions {
  configFile?: string; // 配置文件路径（可选）
  workDir?: string; // 工作目录（可选）
}

// ============ 第 9 篇新增 ============
/**
 * 会话配置
 *
 * 存储在 .jsonl 文件的第一行
 */
export interface SessionConfig {
  summary?: string; // 会话摘要
  createdAt?: string; // 创建时间（ISO 字符串）
  updatedAt?: string; // 更新时间（ISO 字符串）
  activeMessageUuid?: string; // 当前活跃消息（第27篇新增）
}

/**
 * 会话接口
 *
 * 表示一个完整的对话会话
 */
export interface Session {
  id: string; // 会话 ID
  messages: Message[] | EnhancedMessage[]; // 消息列表（支持普通消息和增强消息）
  config?: SessionConfig; // 会话配置（可选）
}

/**
 * 会话元数据
 *
 * 用于列表显示的简化信息
 */
export interface SessionMetadata {
  sessionId: string; // 会话 ID
  summary: string; // 会话摘要
  messageCount: number; // 消息数量
  modified: Date; // 最后修改时间
  created: Date; // 创建时间
}

/**
 * 日志条目类型
 *
 * .jsonl 文件中的每一行
 */
export type LogEntry =
  | { type: 'config'; config: SessionConfig }
  | { type: 'message'; role: MessageRole; content: string; [key: string]: any };

/**
 * Paths 选项
 *
 * 用于创建 Paths 实例的选项
 */
export interface PathsOptions {
  productName: string; // 产品名称（如 'aicli'）
  cwd: string; // 当前工作目录
}

// ============ 第 10 篇新增 ============
/**
 * 事件处理器类型
 *
 * 接收事件数据，无返回值
 */
export type EventHandler<T = any> = (data: T) => void;

/**
 * 会话事件数据
 */
export interface SessionEventData {
  session: Session;
  timestamp: number;
}

/**
 * 工具事件数据
 */
export interface ToolEventData {
  name: string;
  input?: any;
  result?: any;
  error?: Error;
  timestamp: number;
}

/**
 * 消息事件数据
 */
export interface MessageEventData {
  message: Message;
  sessionId: string;
  timestamp: number;
}

/**
 * 事件类型枚举
 *
 * 定义所有可能的事件类型
 */
export enum EventType {
  // 会话事件
  SESSION_CREATED = 'session.created',
  SESSION_LOADED = 'session.loaded',
  SESSION_SAVED = 'session.saved',
  SESSION_DELETED = 'session.deleted',

  // 消息事件
  MESSAGE_SENT = 'message.sent',
  MESSAGE_RECEIVED = 'message.received',

  // 工具事件
  TOOL_BEFORE = 'tool.before',
  TOOL_AFTER = 'tool.after',
  TOOL_ERROR = 'tool.error',
}

// ============ 第 11 篇新增 ============
/**
 * 工具分类
 */
export enum ToolCategory {
  FILE = 'file',
  SEARCH = 'search',
  SYSTEM = 'system',
  NETWORK = 'network',
  TASK = 'task',
  INTERACTIVE = 'interactive',
  SPECIAL = 'special',
}

/**
 * 工具权限
 */
export enum ToolPermission {
  READ_ONLY = 'read_only',
  WRITE = 'write',
  EXECUTE = 'execute',
  NETWORK = 'network',
  INTERACTIVE = 'interactive',
}

/**
 * 工具元数据
 */
export interface ToolMetadata {
  category: ToolCategory;
  permission: ToolPermission;
  dangerous?: boolean; // 是否是危险操作
}

/**
 * 任务接口
 */
export interface Task {
  type: string;
  goal: string;
  context?: any;
  constraints?: any;
}

/**
 * 结果接口
 */ export interface Result {
  success: boolean;
  data: any;
  message?: string;
  error?: Error;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  toolManager: ToolManager;
  sessionService: SessionService;
  eventBus: EventBus;
  [key: string]: any;
}

// ============ 第 26 篇新增：增强配置类型 ============

/**
 * MCP 服务器配置类型
 *
 * MCP (Model Context Protocol) 是一个协议，用于连接 AI 模型和外部工具/服务
 * 支持三种连接方式：stdio（标准输入输出）、SSE（服务器发送事件）、HTTP
 */

// Stdio 方式：通过命令行启动服务器
export type McpStdioServerConfig = {
  type: 'stdio';
  command: string; // 启动命令，如 'uvx'
  args: string[]; // 命令参数
  env?: Record<string, string>; // 环境变量
  disable?: boolean; // 是否禁用
};

// SSE 方式：通过 Server-Sent Events 连接
export type McpSSEServerConfig = {
  type: 'sse';
  url: string; // 服务器 URL
  disable?: boolean;
  headers?: Record<string, string>; // HTTP 头
};

// HTTP 方式：通过 HTTP 请求连接
export type McpHttpServerConfig = {
  type: 'http';
  url: string;
  disable?: boolean;
  headers?: Record<string, string>;
};

// 联合类型：MCP 服务器可以是以上三种之一
export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig;

/**
 * 审批模式
 *
 * 控制 AI 执行操作时的审批流程
 */
export type ApprovalMode =
  | 'default' // 默认：每次都询问用户
  | 'autoEdit' // 自动编辑：自动执行文件编辑操作
  | 'yolo'; // YOLO：完全自动，不询问（危险！）

/**
 * Agent 配置
 *
 * 用于配置特定 Agent 的行为
 * 例如：{ Explore: { model: 'claude-haiku' } }
 */
export interface AgentConfig {
  model?: string; // 该 Agent 使用的模型
  // 预留扩展字段
}

/**
 * 提交配置
 *
 * 用于配置 Git 提交消息生成
 */
export interface CommitConfig {
  language?: string; // 提交消息语言
  systemPrompt?: string; // 自定义系统提示词
  model?: string; // 使用的模型
}

/**
 * 提供商配置
 *
 * 用于配置 AI 提供商（如 OpenAI、Anthropic）
 */
export interface ProviderConfig {
  apiKey?: string; // API 密钥
  baseURL?: string; // API 基础 URL
  // 其他提供商特定配置
}

export type SandboxMode = 'strict' | 'permissive' | 'disabled';

export interface SandboxConfig {
  mode: SandboxMode;
  network: 'deny' | 'allow';
  allowUnsandboxedFallback: boolean;
}

/**
 * 增强的完整配置
 *
 * 这是企业级应用的完整配置接口，包含 26+ 配置项
 * 每个配置项都有明确的用途和类型
 */
export interface EnhancedConfig {
  // ========== 模型配置（4个）==========
  model: string; // 主模型：用于一般任务
  planModel: string; // 规划模型：用于任务规划
  smallModel?: string; // 小模型：用于简单快速的任务
  visionModel?: string; // 视觉模型：用于图像处理任务

  // ========== 基础配置（3个）==========
  language: string; // 界面语言：'English', 'zh-CN' 等
  quiet: boolean; // 静默模式：减少输出
  approvalMode: ApprovalMode; // 审批模式：控制自动化程度
  sandbox: SandboxConfig; // OS 进程沙箱：控制 shell 工具的强制执行边界

  // ========== 插件和服务器（2个）==========
  plugins: string[]; // 插件列表：['logger', 'performance']
  mcpServers: Record<string, McpServerConfig>; // MCP 服务器配置

  // ========== 提供商配置（1个）==========
  provider?: Record<string, ProviderConfig>; // AI 提供商配置

  // ========== 提示词和工具（2个）==========
  systemPrompt?: string; // 系统提示词：自定义 AI 行为
  todo?: boolean; // 启用 TODO：任务管理功能

  // ========== 性能优化（2个）==========
  autoCompact?: boolean; // 自动压缩：压缩对话历史以节省 token
  truncation?: boolean; // 截断输出：截断过长的工具输出

  // ========== 提交配置（1个）==========
  commit?: CommitConfig; // Git 提交配置

  // ========== 工作区配置（1个）==========
  workspace?: WorkspaceConfig; // Git 工作区配置

  // ========== 输出配置（2个）==========
  outputStyle?: string; // 输出样式：'markdown', 'plain' 等
  outputFormat?: 'text' | 'stream-json' | 'json'; // 输出格式

  // ========== 更新和代理（3个）==========
  autoUpdate?: boolean; // 自动更新：自动检查更新
  temperature?: number; // 温度参数：控制输出随机性（0-2）
  httpProxy?: string; // HTTP 代理：用于网络请求

  // ========== 扩展配置（3个）==========
  extensions?: Record<string, any>; // 第三方扩展配置
  tools?: Record<string, boolean>; // 工具开关：启用/禁用特定工具
  agent?: Record<string, AgentConfig>; // Agent 配置：每个 Agent 的设置

  // ========== 通知和技能（2个）==========
  notification?: boolean | string; // 通知设置：true/false 或声音名称
  skills?: string[]; // 技能路径：自定义技能文件路径

  // ========== 思考和检查点（2个）==========
  thinkingLevel?: 'low' | 'medium' | 'high' | 'max' | 'xhigh' | 'maxOrXhigh';
  checkpoints?: boolean; // 启用检查点：保存状态以便回滚
}

/**
 * ConfigManager 选项
 *
 * 用于创建 ConfigManager 实例
 */
export interface ConfigManagerOptions {
  cwd: string; // 当前工作目录
  productName: string; // 产品名称（用于配置文件路径）
  argvConfig?: Partial<EnhancedConfig>; // 命令行参数配置
}

// ============ 第 27 篇新增：会话分叉类型 ============

/**
 * 内容块类型
 *
 * AI 消息可以包含多种类型的内容块
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * 增强的消息类型
 *
 * 添加 uuid 和 parentUuid 支持树形结构
 */
export interface EnhancedMessage {
  uuid: string; // 消息唯一标识
  parentUuid: string | null; // 父消息标识（null 表示根消息）
  role: MessageRole; // 消息角色
  content: string | ContentBlock[]; // 消息内容（文本或内容块数组）
  timestamp: number; // 时间戳
}

/**
 * 分叉选项
 *
 * 用于创建会话分支
 */
export interface ForkOptions {
  fromMessageUuid: string; // 从哪条消息分叉
  newMessage?: EnhancedMessage; // 新消息（可选）
}

/**
 * 消息树节点
 *
 * 用于可视化和导航
 */
export interface MessageTreeNode {
  message: EnhancedMessage;
  children: MessageTreeNode[];
  depth: number;
  isActive: boolean;
}

// ============ 第 28 篇新增：上下文引用类型 ============

/**
 * 上下文提供者接口
 *
 * 每个 Provider 负责解析一种类型的上下文引用
 */
export interface ContextProvider {
  name: string; // Provider 名称（如 'problems', 'terminal'）
  pattern: RegExp; // 匹配模式（如 /#Problems\b/i）
  ttl: number; // 缓存时间（毫秒）

  /**
   * 解析上下文
   *
   * @param match 正则匹配结果
   * @param cwd 当前工作目录
   * @returns 格式化的上下文字符串（Markdown）
   */
  resolve(match: RegExpMatchArray, cwd: string): Promise<string>;

  /**
   * 生成缓存键
   *
   * @param match 正则匹配结果
   * @returns 缓存键
   */
  getCacheKey?(match: RegExpMatchArray): string;
}

/**
 * 上下文缓存
 *
 * 用于缓存已解析的上下文，避免重复计算
 */
export interface ContextCache {
  key: string; // 缓存键（如 'problems', 'terminal', 'file:path/to/file'）
  data: string; // 缓存的数据（Markdown 格式）
  timestamp: number; // 缓存时间戳
  ttl: number; // 生存时间（毫秒）
}

/**
 * 上下文引用
 *
 * 解析后的引用信息
 */
export interface ContextReference {
  type: string; // 引用类型（provider 名称）
  match: RegExpMatchArray; // 正则匹配结果
  provider: ContextProvider; // 对应的 Provider
  originalText: string; // 原始文本（如 '#Problems'）
}

/**
 * 诊断问题
 *
 * 代码中的错误、警告等
 */
export interface DiagnosticProblem {
  file: string; // 文件路径
  line: number; // 行号
  column: number; // 列号
  severity: 'error' | 'warning' | 'info'; // 严重程度
  message: string; // 错误信息
  code?: string; // 错误代码（如 'TS2304'）
}

/**
 * 终端输出
 *
 * 终端历史记录
 */
export interface TerminalOutput {
  command: string; // 执行的命令
  output: string; // 输出内容
  exitCode: number; // 退出码
  timestamp: number; // 时间戳
}

/**
 * Git 变更
 *
 * Git diff 信息
 */
export interface GitChange {
  file: string; // 文件路径
  status: 'added' | 'modified' | 'deleted' | 'renamed'; // 状态
  diff: string; // diff 内容
}

// ============ 第 29 篇新增：Skills 系统类型 ============

/**
 * 技能来源枚举
 *
 * 定义技能的加载优先级（从低到高）
 * 后加载的技能会覆盖先加载的同名技能
 */
export enum SkillSource {
  Plugin = 'plugin', // 来自插件
  Config = 'config', // 来自配置文件
  GlobalClaude = 'global-claude', // 全局 Claude 目录 (~/.claude/skills/)
  Global = 'global', // 全局配置目录 (~/.aicli/skills/)
  ProjectClaude = 'project-claude', // 项目 Claude 目录 (.claude/skills/)
  Project = 'project', // 项目配置目录 (.aicli/skills/)
}

/**
 * 技能接口
 *
 * 定义一个技能的完整信息
 * 技能是可复用的 AI 提示词模板
 */
export interface Skill {
  name: string; // 技能名称（用于调用，如 'code-review'）
  description: string; // 技能描述（显示在帮助信息中）
  content: string; // 技能内容（系统提示词，支持参数占位符）
  source: SkillSource; // 技能来源（用于优先级判断）
  path: string; // 文件路径（用于调试和管理）
}

/**
 * 添加技能选项
 *
 * 用于从 GitHub 安装技能时的配置
 */
export interface AddSkillOptions {
  name?: string; // 自定义技能名称（覆盖 SKILL.md 中的 name）
  overwrite?: boolean; // 是否覆盖已存在的同名技能
  interactive?: boolean; // 是否使用交互式选择（显示技能列表供用户选择）
}

/**
 * 技能 Frontmatter
 *
 * SKILL.md 文件的元数据（YAML 格式）
 * 位于文件开头的 --- 包围的部分
 */
export interface SkillFrontmatter {
  name: string; // 必需：技能名称
  description: string; // 必需：技能描述
  // 预留扩展字段
  version?: string; // 可选：版本号
  author?: string; // 可选：作者
  tags?: string[]; // 可选：标签
}

// ============ 第 30 章新增：Subagents 增强类型 ============

/**
 * Agent 来源枚举
 *
 * 定义 Agent 的加载优先级（从低到高）
 */
export enum AgentSource {
  Builtin = 'builtin', // 内置 Agent
  Plugin = 'plugin', // 来自插件
  Config = 'config', // 来自配置文件
  GlobalClaude = 'global-claude', // 全局 Claude 目录 (~/.claude/agents/)
  Global = 'global', // 全局配置目录 (~/.aicli/agents/)
  ProjectClaude = 'project-claude', // 项目 Claude 目录 (.claude/agents/)
  Project = 'project', // 项目配置目录 (.aicli/agents/)
}

/**
 * Agent 定义
 *
 * 定义一个 Agent 的完整信息
 */
export interface AgentDefinition {
  name: string; // Agent 名称
  description: string; // Agent 描述
  systemPrompt: string; // 系统提示词
  source: AgentSource; // Agent 来源
  path: string; // 文件路径
  tools?: string[]; // 允许的工具列表
  disallowedTools?: string[]; // 禁止的工具列表
  model?: string; // 使用的模型
  forkContext?: boolean; // 是否 fork 上下文
  color?: string; // 显示颜色
}

/**
 * Agent Frontmatter
 *
 * Agent 文件的元数据（YAML 格式）
 */
export interface AgentFrontmatter {
  name: string; // 必需：Agent 名称
  description: string; // 必需：Agent 描述
  tools?: string; // 可选：允许的工具（逗号分隔）
  disallowedTools?: string; // 可选：禁止的工具（逗号分隔）
  model?: string; // 可选：使用的模型
  forkContext?: boolean; // 可选：是否 fork 上下文
  color?: string; // 可选：显示颜色
}

/**
 * Agent 信息
 *
 * 用于列表显示的简化信息
 */
export interface AgentInfo {
  name: string; // Agent 名称
  description: string; // Agent 描述
  source: AgentSource; // Agent 来源
  tools?: string[]; // 允许的工具列表
  disallowedTools?: string[]; // 禁止的工具列表
  model?: string; // 使用的模型
  forkContext?: boolean; // 是否 fork 上下文
  color?: string; // 显示颜色
}

// ============ 第 31 章新增 ============
/**
 * Commit 命令选项
 */
export interface CommitOptions {
  stage?: boolean; // -s: 自动 stage 所有更改
  commit?: boolean; // -c: 自动提交（跳过确认）
  noVerify?: boolean; // -n: 跳过 git hooks
  copy?: boolean; // --copy: 复制到剪贴板
  push?: boolean; // --push: 提交后推送
  checkout?: boolean; // --checkout: 创建新分支
  followStyle?: boolean; // --follow-style: 遵循仓库风格
  model?: string; // -m: 指定模型
}
// ============ 第 32 章新增 ============
/**
 * Workspace 配置
 */
export interface WorkspaceConfig {
  baseBranch?: string; // 默认基础分支
  autoDelete?: boolean; // 完成后自动删除分支
  parentDir?: string; // 工作区父目录
  namePrefix?: string; // 工作区名称前缀
}

/**
 * Workspace 创建选项
 */
export interface WorkspaceCreateOptions {
  name?: string; // 工作区名称
  baseBranch?: string; // 基础分支
  newBranch?: boolean; // 是否创建新分支
}

/**
 * Workspace 信息
 */
export interface WorkspaceInfo {
  path: string; // 工作区路径
  branch: string; // 分支名
  commit: string; // 提交 SHA
  isCurrent: boolean; // 是否当前工作区
}
