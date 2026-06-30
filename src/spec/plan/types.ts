/**
 * 时间估算单位
 */
export type TimeUnit = 'hours' | 'days' | 'weeks';

/**
 * 时间估算
 */
export interface TimeEstimate {
  /** 最小时间 */
  min: number;
  /** 最大时间 */
  max: number;
  /** 预期时间 */
  expected: number;
  /** 时间单位 */
  unit: TimeUnit;
}

/**
 * 任务优先级
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

/**
 * 任务类型
 */
export type TaskType =
  | 'setup' // 环境搭建
  | 'development' // 开发任务
  | 'testing' // 测试任务
  | 'deployment' // 部署任务
  | 'documentation' // 文档任务
  | 'review'; // 代码审查

/**
 * 实施任务
 */
export interface Task {
  /** 任务ID */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务描述 */
  description: string;
  /** 任务类型 */
  type: TaskType;
  /** 优先级 */
  priority: TaskPriority;
  /** 状态 */
  status: TaskStatus;
  /** 时间估算 */
  estimate: TimeEstimate;
  /** 依赖的任务ID列表 */
  dependencies: string[];
  /** 前置条件 */
  prerequisites: string[];
  /** 验收标准 */
  acceptanceCriteria: string[];
  /** 技术要求 */
  technicalRequirements: string[];
  /** 风险评估 */
  risks: string[];
  /** 负责人（可选） */
  assignee?: string;
  /** 标签 */
  tags: string[];
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 实施阶段
 */
export interface Phase {
  /** 阶段ID */
  id: string;
  /** 阶段名称 */
  name: string;
  /** 阶段描述 */
  description: string;
  /** 阶段任务 */
  tasks: Task[];
  /** 时间估算 */
  estimate: TimeEstimate;
  /** 前置条件 */
  prerequisites: string[];
  /** 阶段目标 */
  objectives: string[];
  /** 交付物 */
  deliverables: string[];
  /** 里程碑 */
  milestones: string[];
}

/**
 * 任务依赖关系
 */
export interface TaskDependency {
  /** 依赖任务ID */
  fromTaskId: string;
  /** 被依赖任务ID */
  toTaskId: string;
  /** 依赖类型 */
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  /** 延迟时间（可选） */
  lag?: TimeEstimate;
}

/**
 * 风险评估
 */
export interface Risk {
  /** 风险ID */
  id: string;
  /** 风险名称 */
  name: string;
  /** 风险描述 */
  description: string;
  /** 风险类别 */
  category: 'technical' | 'business' | 'resource' | 'timeline' | 'external';
  /** 影响程度 */
  impact: 'low' | 'medium' | 'high' | 'critical';
  /** 发生概率 */
  probability: 'low' | 'medium' | 'high';
  /** 风险等级 */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** 缓解措施 */
  mitigation: string[];
  /** 应急计划 */
  contingency: string[];
  /** 负责人 */
  owner?: string;
}

/**
 * 资源分配
 */
export interface ResourceAllocation {
  /** 资源类型 */
  type: 'developer' | 'designer' | 'tester' | 'devops' | 'manager';
  /** 资源数量 */
  count: number;
  /** 技能要求 */
  skills: string[];
  /** 分配时间 */
  allocation: TimeEstimate;
}

/**
 * 实施计划
 */
export interface ImplementationPlan {
  /** 计划ID */
  id: string;
  /** 关联的规格文档ID */
  specId: string;
  /** 计划名称 */
  name: string;
  /** 计划描述 */
  description: string;
  /** 实施阶段 */
  phases: Phase[];
  /** 总时间估算 */
  totalEstimate: TimeEstimate;
  /** 任务依赖关系 */
  dependencies: TaskDependency[];
  /** 风险评估 */
  risks: Risk[];
  /** 资源分配 */
  resources: ResourceAllocation[];
  /** 关键路径 */
  criticalPath: string[];
  /** 项目路径 */
  projectPath: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 创建者 */
  createdBy?: string;
}

/**
 * 计划生成选项
 */
export interface PlanGenerationOptions {
  /** 详细程度 */
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  /** 包含风险评估 */
  includeRiskAssessment: boolean;
  /** 包含资源分配 */
  includeResourceAllocation: boolean;
  /** 包含时间估算 */
  includeTimeEstimation: boolean;
  /** 团队规模 */
  teamSize: 'small' | 'medium' | 'large';
  /** 项目复杂度 */
  complexity: 'low' | 'medium' | 'high';
  /** 时间约束 */
  timeConstraint?: TimeEstimate;
  /** 预算约束 */
  budgetConstraint?: number;
}

/**
 * 计划生成请求
 */
export interface CreatePlanRequest {
  /** 规格文档ID */
  specId: string;
  /** 计划名称 */
  name?: string;
  /** 计划描述 */
  description?: string;
  /** 生成选项 */
  options: PlanGenerationOptions;
  /** 项目路径 */
  projectPath: string;
}

/**
 * 计划更新请求
 */
export interface UpdatePlanRequest {
  /** 计划ID */
  id: string;
  /** 更新的字段 */
  updates: Partial<Omit<ImplementationPlan, 'id' | 'createdAt' | 'createdBy'>>;
}
