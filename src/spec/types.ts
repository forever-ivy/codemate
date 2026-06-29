import { z } from 'zod';

// ===== 基础枚举类型 =====

/**
 * 规格文档状态
 *
 * 这个枚举定义了文档的生命周期状态
 */
export type SpecStatus = 'draft' | 'review' | 'approved' | 'implemented' | 'archived';

/**
 * 任务状态
 *
 * 定义了任务的执行状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

/**
 * 任务优先级
 *
 * 用于任务排序和资源分配
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// ===== 核心数据结构 =====

/**
 * 时间估算
 *
 * 包含估算时间、置信度和可选的说明
 */
export interface TimeEstimate {
  /** 估算时间（小时） */
  hours: number;
  /** 置信度 (0-1)，表示估算的准确性 */
  confidence: number;
  /** 可选的估算说明 */
  notes?: string;
}

/**
 * 规格文档元数据
 *
 * 存储文档的基本信息和管理数据
 */
export interface SpecMetadata {
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 文档创建者 */
  author: string;
  /** 标签列表，用于分类和搜索 */
  tags: string[];
  /** 项目根路径 */
  projectPath: string;
  /** 相关文件列表 */
  relatedFiles: string[];
}

/**
 * 规格任务
 *
 * 表示规格文档中的一个具体任务
 */
export interface SpecTask {
  /** 任务唯一标识符 */
  id: string;
  /** 任务标题 */
  title: string;
  /** 任务详细描述 */
  description: string;
  /** 当前状态 */
  status: TaskStatus;
  /** 优先级 */
  priority: TaskPriority;
  /** 时间估算 */
  estimate: TimeEstimate;
  /** 依赖的任务ID列表 */
  dependencies: string[];
  /** 任务分配给的执行者 */
  assignee?: string;
  /** 任务标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
  /** 完成时间（仅当状态为 completed 时） */
  completedAt?: Date;
  /** 任务备注 */
  notes: string;
}

/**
 * 规格文档
 *
 * 系统的核心数据结构，表示一个完整的项目规格
 */
export interface SpecDocument {
  /** 文档唯一标识符 */
  id: string;
  /** 文档标题 */
  title: string;
  /** 文档描述 */
  description: string;
  /** 文档版本（语义化版本） */
  version: string;
  /** 文档当前状态 */
  status: SpecStatus;
  /** 文档内容（Markdown 格式） */
  content: string;
  /** 任务列表 */
  tasks: SpecTask[];
  /** 文档元数据 */
  metadata: SpecMetadata;
  /** 父文档ID（用于版本分支） */
  parentId?: string;
  /** 分支名称 */
  branch?: string;
}

/**
 * 规格文档摘要
 *
 * 用于列表显示和快速查询，包含关键信息但不包含完整内容
 */
export interface SpecDocumentSummary {
  id: string;
  title: string;
  description: string;
  version: string;
  status: SpecStatus;
  /** 任务总数 */
  taskCount: number;
  /** 已完成任务数 */
  completedTaskCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: string;
  tags: string[];
}

// ===== Zod 验证模式 =====

/**
 * 时间估算验证模式
 */
export const TimeEstimateSchema = z.object({
  hours: z.number().min(0).max(1000), // 0-1000小时范围
  confidence: z.number().min(0).max(1), // 0-1置信度范围
  notes: z.string().optional(), // 可选字符串
});

/**
 * 规格任务验证模式
 */
export const SpecTaskSchema = z.object({
  id: z.string().min(1), // 非空字符串
  title: z.string().min(1).max(200), // 1-200字符标题
  description: z.string().max(2000), // 最多2000字符描述
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimate: TimeEstimateSchema,
  dependencies: z.array(z.string()), // 字符串数组
  assignee: z.string().optional(), // 可选分配者
  tags: z.array(z.string()), // 标签数组
  createdAt: z.date(), // 日期对象
  updatedAt: z.date(), // 日期对象
  completedAt: z.date().optional(), // 可选完成时间
  notes: z.string(), // 备注字符串
});

/**
 * 规格文档验证模式
 */
export const SpecDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // 语义化版本格式
  status: z.enum(['draft', 'review', 'approved', 'implemented', 'archived']),
  content: z.string(),
  tasks: z.array(SpecTaskSchema),
  metadata: z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    author: z.string().min(1),
    tags: z.array(z.string()),
    projectPath: z.string().min(1),
    relatedFiles: z.array(z.string()),
  }),
  parentId: z.string().optional(),
  branch: z.string().optional(),
});

// ===== 操作相关类型 =====

/**
 * 创建规格文档请求
 */
export interface CreateSpecRequest {
  title: string;
  description: string;
  content?: string;
  tags?: string[];
  projectPath?: string;
}

/**
 * 更新规格文档请求
 */
export interface UpdateSpecRequest {
  title?: string;
  description?: string;
  content?: string;
  status?: SpecStatus;
  tags?: string[];
}

/**
 * 创建任务请求
 */
export interface CreateTaskRequest {
  title: string;
  description: string;
  priority?: TaskPriority;
  estimate?: Partial<TimeEstimate>;
  dependencies?: string[];
  assignee?: string;
  tags?: string[];
}

/**
 * 更新任务请求
 */
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  estimate?: Partial<TimeEstimate>;
  dependencies?: string[];
  assignee?: string;
  tags?: string[];
  notes?: string;
}

// ===== 查询相关类型 =====

/**
 * 规格文档过滤条件
 */
export interface SpecFilters {
  status?: SpecStatus[];
  tags?: string[];
  author?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  search?: string;
}

/**
 * 排序选项
 */
export interface SortOptions {
  field: 'createdAt' | 'updatedAt' | 'title' | 'status' | 'version';
  direction: 'asc' | 'desc';
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * 查询结果
 */
export interface QueryResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== 事件相关类型 =====

/**
 * Spec 事件类型
 */
export type SpecEventType =
  | 'spec_created'
  | 'spec_updated'
  | 'spec_deleted'
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_deleted';

/**
 * Spec 事件
 */
export interface SpecEvent {
  type: SpecEventType;
  specId: string;
  taskId?: string;
  timestamp: Date;
  data: any;
}

// ===== 导出相关类型 =====

/**
 * 导出格式
 */
export type ExportFormat = 'json' | 'markdown' | 'html';

/**
 * 导出选项
 */
export interface ExportOptions {
  format: ExportFormat;
  includeTasks: boolean;
  includeMetadata: boolean;
  includeHistory: boolean;
}
