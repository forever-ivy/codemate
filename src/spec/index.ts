// ===== 核心类型导出 =====
export type {
  SpecStatus,
  TaskStatus,
  TaskPriority,
  TimeEstimate,
  SpecMetadata,
  SpecTask,
  SpecDocument,
  SpecDocumentSummary,
  CreateSpecRequest,
  UpdateSpecRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  SpecFilters,
  SortOptions,
  PaginationOptions,
  QueryResult,
  SpecEvent,
  SpecEventType,
  ExportOptions,
  ExportFormat,
} from './types.js';

// ===== Zod 验证模式导出 =====
export {
  TimeEstimateSchema,
  SpecTaskSchema,
  SpecDocumentSchema,
} from './types.js';

// ===== 核心类导出 =====
export { SpecParser } from './SpecParser.js';
export type { ParseResult } from './SpecParser.js';

export { SpecManager } from './SpecManager.js';

export { SpecStorage } from './SpecStorage.js';
export type { BackupInfo, StorageStats } from './SpecStorage.js';

// ===== 工具函数导出 =====
export {
  calculateTaskProgress,
  calculateTotalEstimate,
  getPriorityWeight,
  sortTasksByPriority,
  getExecutableTasks,
  detectCircularDependencies,
  formatTimeEstimate,
  parseTimeEstimate,
  generateDocumentSummary,
  validateDocument,
} from './utils.js';
