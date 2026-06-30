/**
 * 执行模式
 */
export type ExecutionMode = 'manual' | 'auto' | 'hybrid';

/**
 * 任务执行状态
 */
export type TaskExecutionStatus =
  | 'pending' // 待执行
  | 'ready' // 可执行
  | 'in_progress' // 执行中
  | 'completed' // 已完成
  | 'failed' // 执行失败
  | 'skipped' // 已跳过
  | 'blocked'; // 被阻塞

/**
 * 执行步骤状态
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤ID */
  id: string;
  /** 步骤名称 */
  name: string;
  /** 步骤描述 */
  description: string;
  /** 执行命令或操作 */
  command?: string;
  /** 预期结果 */
  expectedResult: string;
  /** 验证方法 */
  validation?: string;
  /** 状态 */
  status: StepStatus;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 执行结果 */
  result?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  /** 任务ID */
  taskId: string;
  /** 执行状态 */
  status: TaskExecutionStatus;
  /** 执行步骤 */
  steps: ExecutionStep[];
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 执行时长（毫秒） */
  duration?: number;
  /** 成功的步骤数 */
  successfulSteps: number;
  /** 失败的步骤数 */
  failedSteps: number;
  /** 执行日志 */
  logs: string[];
  /** 错误信息 */
  error?: string;
  /** 执行者 */
  executor?: string;
}
/**
 * 执行会话
 */
export interface ExecutionSession {
  /** 会话ID */
  id: string;
  /** 关联的计划ID */
  planId: string;
  /** 会话名称 */
  name: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 会话状态 */
  status: 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /** 任务执行结果 */
  taskResults: Map<string, TaskExecutionResult>;
  /** 当前执行的任务ID */
  currentTaskId?: string;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 总执行时长 */
  totalDuration?: number;
  /** 执行统计 */
  statistics: ExecutionStatistics;
  /** 执行日志 */
  logs: ExecutionLog[];
  /** 创建者 */
  createdBy?: string;
}

/**
 * 执行统计
 */
export interface ExecutionStatistics {
  /** 总任务数 */
  totalTasks: number;
  /** 已完成任务数 */
  completedTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 跳过任务数 */
  skippedTasks: number;
  /** 总进度百分比 */
  overallProgress: number;
  /** 各阶段进度 */
  phaseProgress: Map<string, number>;
  /** 预计剩余时间 */
  estimatedRemainingTime?: number;
  /** 实际用时 vs 预估用时 */
  timeVariance?: number;
}

/**
 * 执行日志
 */
export interface ExecutionLog {
  /** 日志ID */
  id: string;
  /** 时间戳 */
  timestamp: Date;
  /** 日志级别 */
  level: 'info' | 'warn' | 'error' | 'debug';
  /** 日志消息 */
  message: string;
  /** 关联的任务ID */
  taskId?: string;
  /** 关联的步骤ID */
  stepId?: string;
  /** 额外数据 */
  metadata?: Record<string, any>;
}

/**
 * 任务依赖信息
 */
export interface TaskDependencyInfo {
  /** 任务ID */
  taskId: string;
  /** 依赖的任务ID列表 */
  dependencies: string[];
  /** 被依赖的任务ID列表 */
  dependents: string[];
  /** 是否可执行 */
  isExecutable: boolean;
  /** 阻塞原因 */
  blockingReasons: string[];
}

/**
 * 执行进度信息
 */
export interface ExecutionProgress {
  /** 总体进度 */
  overall: {
    percentage: number;
    completedTasks: number;
    totalTasks: number;
    estimatedRemainingTime?: number;
  };
  /** 各阶段进度 */
  phases: Array<{
    phaseId: string;
    phaseName: string;
    percentage: number;
    completedTasks: number;
    totalTasks: number;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  /** 当前执行任务 */
  currentTask?: {
    taskId: string;
    taskName: string;
    progress: number;
    estimatedRemainingTime?: number;
  };
}

/**
 * 创建执行会话请求
 */
export interface CreateExecutionSessionRequest {
  /** 计划ID */
  planId: string;
  /** 会话名称（可选） */
  name?: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 执行选项 */
  options?: ExecutionOptions;
}

/**
 * 执行选项
 */
export interface ExecutionOptions {
  /** 是否自动执行依赖任务 */
  autoExecuteDependencies?: boolean;
  /** 失败时是否继续执行 */
  continueOnFailure?: boolean;
  /** 是否并行执行独立任务 */
  parallelExecution?: boolean;
  /** 最大并行任务数 */
  maxParallelTasks?: number;
  /** 执行超时时间（毫秒） */
  executionTimeout?: number;
  /** 是否生成详细日志 */
  verboseLogging?: boolean;
}

/**
 * 任务执行请求
 */
export interface ExecuteTaskRequest {
  /** 会话ID */
  sessionId: string;
  /** 任务ID */
  taskId: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 执行选项 */
  options?: ExecutionOptions;
}
