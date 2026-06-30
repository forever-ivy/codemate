/**
 * Spec 系统集成相关类型定义
 */

import type { SpecDocument } from '../types.js';
import type { ImplementationPlan } from '../plan/types.js';
import type { ExecutionSession } from '../execution/types.js';
import type { DesignDocument } from '../design/types.js';

// ===== 项目上下文 =====

/**
 * 项目上下文
 * 包含项目的完整状态和元数据
 */
export interface ProjectContext {
  /** 项目唯一标识符 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description: string;
  /** 项目路径 */
  path: string;
  /** 项目状态 */
  status: ProjectStatus;
  /** 关联的规格文档 */
  spec?: SpecDocument;
  /** 关联的实施计划 */
  plan?: ImplementationPlan;
  /** 关联的执行会话 */
  execution?: ExecutionSession;
  /** 关联的设计文档 */
  designs: DesignDocument[];
  /** 项目元数据 */
  metadata: ProjectMetadata;
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 项目状态
 */
export type ProjectStatus =
  | 'initializing' // 初始化中
  | 'brainstorming' // 头脑风暴阶段
  | 'planning' // 计划制定阶段
  | 'executing' // 执行阶段
  | 'documenting' // 文档生成阶段
  | 'completed' // 已完成
  | 'paused' // 已暂停
  | 'cancelled'; // 已取消

/**
 * 项目元数据
 */
export interface ProjectMetadata {
  /** 项目类型 */
  type: 'web' | 'mobile' | 'desktop' | 'api' | 'library' | 'other';
  /** 技术栈 */
  techStack: string[];
  /** 团队规模 */
  teamSize: 'small' | 'medium' | 'large';
  /** 项目复杂度 */
  complexity: 'low' | 'medium' | 'high';
  /** 预计工期（天） */
  estimatedDuration?: number;
  /** 项目标签 */
  tags: string[];
  /** 项目负责人 */
  owner?: string;
  /** 项目成员 */
  members: string[];
}

// ===== 工作流相关 =====

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流唯一标识符 */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description: string;
  /** 工作流版本 */
  version: string;
  /** 工作流步骤 */
  steps: WorkflowStep[];
  /** 工作流配置 */
  config: WorkflowConfig;
  /** 前置条件 */
  prerequisites: string[];
  /** 预期结果 */
  expectedOutcomes: string[];
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤唯一标识符 */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 步骤类型 */
  type: WorkflowStepType;
  /** 步骤配置 */
  config: WorkflowStepConfig;
  /** 依赖的步骤 */
  dependencies: string[];
  /** 是否可选 */
  optional: boolean;
  /** 超时时间（秒） */
  timeout?: number;
  /** 重试次数 */
  retryCount?: number;
}

/**
 * 工作流步骤类型
 */
export type WorkflowStepType =
  | 'brainstorm' // 头脑风暴
  | 'plan' // 计划制定
  | 'execute' // 执行任务
  | 'document' // 生成文档
  | 'validate' // 验证结果
  | 'notify' // 发送通知
  | 'custom'; // 自定义步骤

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  /** 是否自动执行 */
  autoExecute: boolean;
  /** 是否允许并行执行 */
  allowParallel: boolean;
  /** 失败时是否继续 */
  continueOnFailure: boolean;
  /** 通知配置 */
  notifications: NotificationConfig;
  /** 缓存配置 */
  cache: CacheConfig;
}

/**
 * 工作流步骤配置
 */
export interface WorkflowStepConfig {
  /** 步骤参数 */
  parameters: Record<string, any>;
  /** 输入映射 */
  inputMapping: Record<string, string>;
  /** 输出映射 */
  outputMapping: Record<string, string>;
  /** 条件执行 */
  condition?: string;
}

// ===== 工作流执行相关 =====

/**
 * 工作流上下文
 */
export interface WorkflowContext {
  /** 项目上下文 */
  project: ProjectContext;
  /** 用户输入 */
  userInput: Record<string, any>;
  /** 环境变量 */
  environment: Record<string, string>;
  /** 执行选项 */
  options: WorkflowExecutionOptions;
}

/**
 * 工作流执行选项
 */
export interface WorkflowExecutionOptions {
  /** 是否跳过确认 */
  skipConfirmation: boolean;
  /** 是否详细输出 */
  verbose: boolean;
  /** 是否干运行 */
  dryRun: boolean;
  /** 并发限制 */
  concurrency: number;
  /** 超时时间（秒） */
  timeout: number;
}

/**
 * 工作流结果
 */
export interface WorkflowResult {
  /** 工作流ID */
  workflowId: string;
  /** 执行状态 */
  status: WorkflowStatus;
  /** 执行开始时间 */
  startTime: Date;
  /** 执行结束时间 */
  endTime?: Date;
  /** 步骤结果 */
  stepResults: Map<string, WorkflowStepResult>;
  /** 输出数据 */
  outputs: Record<string, any>;
  /** 错误信息 */
  error?: string;
  /** 执行统计 */
  statistics: WorkflowStatistics;
}

/**
 * 工作流状态
 */
export type WorkflowStatus =
  | 'pending' // 等待执行
  | 'running' // 执行中
  | 'paused' // 已暂停
  | 'completed' // 已完成
  | 'failed' // 执行失败
  | 'cancelled'; // 已取消

/**
 * 工作流步骤结果
 */
export interface WorkflowStepResult {
  /** 步骤ID */
  stepId: string;
  /** 执行状态 */
  status: WorkflowStepStatus;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 输出数据 */
  outputs: Record<string, any>;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 工作流步骤状态
 */
export type WorkflowStepStatus =
  | 'pending' // 等待执行
  | 'running' // 执行中
  | 'completed' // 已完成
  | 'failed' // 执行失败
  | 'skipped'; // 已跳过

/**
 * 工作流统计
 */
export interface WorkflowStatistics {
  /** 总步骤数 */
  totalSteps: number;
  /** 已完成步骤数 */
  completedSteps: number;
  /** 失败步骤数 */
  failedSteps: number;
  /** 跳过步骤数 */
  skippedSteps: number;
  /** 总执行时间（毫秒） */
  totalDuration: number;
  /** 平均步骤执行时间（毫秒） */
  averageStepDuration: number;
}

// ===== 缓存相关 =====

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 缓存TTL（秒） */
  ttl: number;
  /** 最大缓存大小（MB） */
  maxSize: number;
  /** 缓存策略 */
  strategy: CacheStrategy;
}

/**
 * 缓存策略
 */
export type CacheStrategy =
  | 'lru' // 最近最少使用
  | 'lfu' // 最少使用频率
  | 'ttl' // 基于时间
  | 'adaptive'; // 自适应

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  /** 缓存键 */
  key: string;
  /** 缓存值 */
  value: T;
  /** 创建时间 */
  createdAt: Date;
  /** 最后访问时间 */
  lastAccessedAt: Date;
  /** 访问次数 */
  accessCount: number;
  /** 过期时间 */
  expiresAt?: Date;
  /** 数据大小（字节） */
  size: number;
}

/**
 * 预加载任务
 */
export interface PreloadTask {
  /** 任务ID */
  id: string;
  /** 任务类型 */
  type: 'spec' | 'plan' | 'execution' | 'design';
  /** 资源标识符 */
  resourceId: string;
  /** 优先级 */
  priority: number;
  /** 预加载选项 */
  options: PreloadOptions;
}

/**
 * 预加载选项
 */
export interface PreloadOptions {
  /** 是否预加载关联数据 */
  includeRelated: boolean;
  /** 预加载深度 */
  depth: number;
  /** 缓存时间（秒） */
  cacheDuration: number;
}

// ===== 监控相关 =====

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** CPU使用率 */
  cpuUsage: number;
  /** 内存使用量（MB） */
  memoryUsage: number;
  /** 磁盘使用量（MB） */
  diskUsage: number;
  /** 网络IO（KB/s） */
  networkIO: number;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 吞吐量（请求/秒） */
  throughput: number;
}

/**
 * 系统健康状态
 */
export interface SystemHealth {
  /** 整体状态 */
  status: 'healthy' | 'warning' | 'critical';
  /** 各组件状态 */
  components: Map<string, ComponentHealth>;
  /** 性能指标 */
  metrics: PerformanceMetrics;
  /** 最后检查时间 */
  lastCheckTime: Date;
}

/**
 * 组件健康状态
 */
export interface ComponentHealth {
  /** 组件名称 */
  name: string;
  /** 健康状态 */
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  /** 状态消息 */
  message: string;
  /** 最后检查时间 */
  lastCheckTime: Date;
  /** 响应时间（毫秒） */
  responseTime?: number;
}

// ===== 通知相关 =====

/**
 * 通知配置
 */
export interface NotificationConfig {
  /** 是否启用通知 */
  enabled: boolean;
  /** 通知渠道 */
  channels: NotificationChannel[];
  /** 通知级别 */
  level: NotificationLevel;
  /** 通知模板 */
  templates: Map<string, NotificationTemplate>;
}

/**
 * 通知渠道
 */
export type NotificationChannel =
  | 'console' // 控制台输出
  | 'email' // 邮件通知
  | 'slack' // Slack通知
  | 'webhook'; // Webhook通知

/**
 * 通知级别
 */
export type NotificationLevel =
  | 'debug' // 调试信息
  | 'info' // 一般信息
  | 'warning' // 警告信息
  | 'error' // 错误信息
  | 'critical'; // 严重错误

/**
 * 通知模板
 */
export interface NotificationTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 消息标题模板 */
  titleTemplate: string;
  /** 消息内容模板 */
  contentTemplate: string;
  /** 支持的渠道 */
  supportedChannels: NotificationChannel[];
}

// ===== 优化相关 =====

/**
 * 优化结果
 */
export interface OptimizationResult {
  /** 优化类型 */
  type: OptimizationType;
  /** 优化前指标 */
  before: PerformanceMetrics;
  /** 优化后指标 */
  after: PerformanceMetrics;
  /** 改进百分比 */
  improvement: number;
  /** 优化建议 */
  recommendations: string[];
  /** 优化时间 */
  optimizedAt: Date;
}

/**
 * 优化类型
 */
export type OptimizationType =
  | 'memory' // 内存优化
  | 'cpu' // CPU优化
  | 'disk' // 磁盘优化
  | 'network' // 网络优化
  | 'cache' // 缓存优化
  | 'database'; // 数据库优化

/**
 * 内存使用情况
 */
export interface MemoryUsage {
  /** 已使用内存（MB） */
  used: number;
  /** 总内存（MB） */
  total: number;
  /** 使用率 */
  percentage: number;
  /** 各组件内存使用 */
  breakdown: Map<string, number>;
}

// ===== 创建项目选项 =====

/**
 * 创建项目选项
 */
export interface CreateProjectOptions {
  /** 项目名称 */
  name: string;
  /** 项目描述 */
  description: string;
  /** 项目路径 */
  path: string;
  /** 项目类型 */
  type: ProjectMetadata['type'];
  /** 技术栈 */
  techStack: string[];
  /** 团队规模 */
  teamSize: ProjectMetadata['teamSize'];
  /** 项目复杂度 */
  complexity: ProjectMetadata['complexity'];
  /** 工作流模板 */
  workflowTemplate?: string;
  /** 初始化选项 */
  initOptions: ProjectInitOptions;
}

/**
 * 项目初始化选项
 */
export interface ProjectInitOptions {
  /** 是否自动开始头脑风暴 */
  autoStartBrainstorm: boolean;
  /** 是否使用默认模板 */
  useDefaultTemplate: boolean;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 是否启用监控 */
  enableMonitoring: boolean;
  /** 通知配置 */
  notifications: Partial<NotificationConfig>;
}
