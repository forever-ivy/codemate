import type { SpecDocument, SpecTask, TaskPriority, TimeEstimate } from './types.js';

// ===== 任务相关工具函数 =====

/**
 * 计算任务完成进度
 *
 * @param tasks 任务列表
 * @returns 进度统计
 */
export function calculateTaskProgress(tasks: SpecTask[]): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  cancelled: number;
  percentage: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const cancelled = tasks.filter((t) => t.status === 'cancelled').length;

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    inProgress,
    pending,
    blocked,
    cancelled,
    percentage,
  };
}

/**
 * 计算总时间估算
 *
 * @param tasks 任务列表
 * @returns 总时间估算
 */
export function calculateTotalEstimate(tasks: SpecTask[]): TimeEstimate {
  if (tasks.length === 0) {
    return { hours: 0, confidence: 1 };
  }

  const totalHours = tasks.reduce((sum, task) => sum + task.estimate.hours, 0);
  const avgConfidence =
    tasks.reduce((sum, task) => sum + task.estimate.confidence, 0) / tasks.length;

  return {
    hours: totalHours,
    confidence: avgConfidence,
    notes: `基于 ${tasks.length} 个任务的估算`,
  };
}
/**
 * 获取任务优先级权重
 *
 * @param priority 优先级
 * @returns 权重值
 */
export function getPriorityWeight(priority: TaskPriority): number {
  const weights = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return weights[priority];
}

/**
 * 按优先级排序任务
 *
 * @param tasks 任务列表
 * @returns 排序后的任务列表
 */
export function sortTasksByPriority(tasks: SpecTask[]): SpecTask[] {
  return [...tasks].sort((a, b) => {
    const weightA = getPriorityWeight(a.priority);
    const weightB = getPriorityWeight(b.priority);

    if (weightA !== weightB) {
      return weightB - weightA; // 高优先级在前
    }

    // 优先级相同时，按创建时间排序
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * 获取可执行的任务（没有未完成依赖的任务）
 *
 * @param tasks 任务列表
 * @returns 可执行的任务列表
 */
export function getExecutableTasks(tasks: SpecTask[]): SpecTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return tasks.filter((task) => {
    // 已完成或取消的任务不可执行
    if (task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }

    // 检查所有依赖是否已完成
    return task.dependencies.every((depId) => {
      const depTask = taskMap.get(depId);
      return depTask?.status === 'completed';
    });
  });
}

/**
 * 检测任务依赖循环
 *
 * @param tasks 任务列表
 * @returns 循环依赖路径列表
 */
export function detectCircularDependencies(tasks: SpecTask[]): string[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(taskId: string, path: string[]): void {
    if (recursionStack.has(taskId)) {
      // 发现循环
      const cycleStart = path.indexOf(taskId);
      const cycle = path.slice(cycleStart).concat(taskId);
      cycles.push(cycle.join(' -> '));
      return;
    }

    if (visited.has(taskId)) {
      return;
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        dfs(depId, [...path, taskId]);
      }
    }

    recursionStack.delete(taskId);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return cycles;
}

// ===== 时间相关工具函数 =====

/**
 * 格式化时间估算
 *
 * @param estimate 时间估算
 * @returns 格式化字符串
 */
export function formatTimeEstimate(estimate: TimeEstimate): string {
  const hours = estimate.hours;
  const confidence = Math.round(estimate.confidence * 100);

  if (hours < 1) {
    return `${Math.round(hours * 60)}分钟 (${confidence}%)`;
  } else if (hours < 8) {
    return `${hours}小时 (${confidence}%)`;
  } else {
    const days = Math.round((hours / 8) * 10) / 10;
    return `${days}天 (${confidence}%)`;
  }
}

/**
 * 解析时间估算字符串
 *
 * @param input 输入字符串
 * @returns 时间估算对象或 null
 */
export function parseTimeEstimate(input: string): TimeEstimate | null {
  // 匹配各种格式：1h, 2小时, 30分钟, 1.5天, 等
  const patterns = [
    /^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i,
    /^(\d+(?:\.\d+)?)\s*小时$/,
    /^(\d+(?:\.\d+)?)\s*(?:分钟|min(?:utes?)?)$/i,
    /^(\d+(?:\.\d+)?)\s*(?:天|days?)$/i,
  ];

  const input_clean = input.trim().toLowerCase();

  // 小时格式
  let match = input_clean.match(patterns[0]) || input_clean.match(patterns[1]);
  if (match) {
    return { hours: parseFloat(match[1]), confidence: 0.7 };
  }

  // 分钟格式
  match = input_clean.match(patterns[2]);
  if (match) {
    return { hours: parseFloat(match[1]) / 60, confidence: 0.8 };
  }

  // 天格式
  match = input_clean.match(patterns[3]);
  if (match) {
    return { hours: parseFloat(match[1]) * 8, confidence: 0.6 };
  }

  return null;
}

// ===== 文档相关工具函数 =====

/**
 * 生成文档摘要
 *
 * @param document 文档对象
 * @returns 摘要字符串
 */
export function generateDocumentSummary(document: SpecDocument): string {
  const progress = calculateTaskProgress(document.tasks);
  const estimate = calculateTotalEstimate(document.tasks);

  return `${document.title} (v${document.version}) - ${progress.percentage}% 完成，预计 ${estimate.hours} 小时`;
}

/**
 * 验证文档完整性
 *
 * @param document 文档对象
 * @returns 验证结果
 */
export function validateDocument(document: SpecDocument): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需字段
  if (!document.title.trim()) {
    errors.push('文档标题不能为空');
  }

  if (!document.description.trim()) {
    warnings.push('建议添加文档描述');
  }

  // 检查任务
  const taskIds = new Set<string>();
  for (const task of document.tasks) {
    // 检查任务ID唯一性
    if (taskIds.has(task.id)) {
      errors.push(`重复的任务ID: ${task.id}`);
    }
    taskIds.add(task.id);

    // 检查任务标题
    if (!task.title.trim()) {
      errors.push(`任务 ${task.id} 缺少标题`);
    }

    // 检查依赖关系
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        errors.push(`任务 ${task.id} 依赖不存在的任务: ${depId}`);
      }
    }
  }

  // 检查循环依赖
  const cycles = detectCircularDependencies(document.tasks);
  if (cycles.length > 0) {
    errors.push(`检测到循环依赖: ${cycles.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
