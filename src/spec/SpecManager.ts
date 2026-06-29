import { promises as fs } from 'node:fs';
import { join } from 'pathe';
import { nanoid } from 'nanoid';
import type { EventBus } from '../services/EventBus.js';
import type { Paths } from '../services/Paths.js';
import { SpecParser } from './SpecParser.js';
import type {
  SpecDocument,
  SpecDocumentSummary,
  SpecTask,
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
} from './types.js';

/**
 * 存储配置
 */
interface StorageConfig {
  /** 规格文档存储目录 */
  specsDir: string;
  /** 备份目录 */
  backupDir: string;
  /** 索引文件路径 */
  indexFile: string;
}

/**
 * 规格文档索引
 */
interface SpecIndex {
  /** 文档摘要列表 */
  specs: SpecDocumentSummary[];
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 版本号 */
  version: string;
}

/**
 * SpecManager - Spec 文档管理器
 *
 * 职责：
 * 1. 文档 CRUD 操作
 * 2. 任务管理
 * 3. 事件发送
 * 4. 索引维护
 * 5. 导出功能
 */
export class SpecManager {
  private storage: StorageConfig;
  private index: SpecIndex | null = null;
  private indexLoaded = false;

  constructor(
    private eventBus: EventBus,
    private paths: Paths
  ) {
    this.storage = {
      specsDir: join(this.paths.getDataDir(), 'specs'),
      backupDir: join(this.paths.getDataDir(), 'specs', 'backups'),
      indexFile: join(this.paths.getDataDir(), 'specs', 'index.json'),
    };
  }

  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    await this.ensureDirectories();

    // 加载索引
    await this.loadIndex();

    // 验证索引完整性
    await this.validateIndex();
  }

  // ===== 文档 CRUD 操作 =====

  /**
   * 创建新的规格文档
   *
   * @param request 创建请求
   * @returns 创建的文档
   */
  async create(request: CreateSpecRequest): Promise<SpecDocument> {
    const id = nanoid();
    const now = new Date();

    // 构建文档对象
    const document: SpecDocument = {
      id,
      title: request.title,
      description: request.description,
      version: '1.0.0',
      status: 'draft',
      content: request.content || this.getDefaultContent(request.title),
      tasks: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        author: process.env.USER || 'unknown',
        tags: request.tags || [],
        projectPath: request.projectPath || process.cwd(),
        relatedFiles: [],
      },
    };

    // 保存文档
    await this.saveDocument(document);

    // 更新索引
    await this.updateIndex(document);

    // 发送事件
    this.emitEvent('spec_created', document.id, { document });

    return document;
  }

  /**
   * 获取规格文档
   *
   * @param id 文档 ID
   * @returns 文档对象或 null
   */
  async get(id: string): Promise<SpecDocument | null> {
    try {
      const filePath = this.getDocumentPath(id);
      const content = await fs.readFile(filePath, 'utf-8');

      const parseResult = SpecParser.parse(content, id);
      if (!parseResult.success || !parseResult.document) {
        console.warn(`解析文档失败 ${id}:`, parseResult.errors);
        return null;
      }

      return parseResult.document;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // 文件不存在
      }
      throw error; // 其他错误向上抛出
    }
  }

  /**
   * 更新规格文档
   *
   * @param id 文档 ID
   * @param request 更新请求
   * @returns 更新后的文档或 null
   */
  async update(id: string, request: UpdateSpecRequest): Promise<SpecDocument | null> {
    const document = await this.get(id);
    if (!document) {
      return null;
    }

    // 创建备份
    await this.createBackup(document);

    // 更新文档
    const updatedDocument: SpecDocument = {
      ...document,
      title: request.title ?? document.title,
      description: request.description ?? document.description,
      content: request.content ?? document.content,
      status: request.status ?? document.status,
      metadata: {
        ...document.metadata,
        updatedAt: new Date(),
        tags: request.tags ?? document.metadata.tags,
      },
    };

    // 保存文档
    await this.saveDocument(updatedDocument);

    // 更新索引
    await this.updateIndex(updatedDocument);

    // 发送事件
    this.emitEvent('spec_updated', id, {
      document: updatedDocument,
      changes: request,
    });

    return updatedDocument;
  }

  /**
   * 删除规格文档
   *
   * @param id 文档 ID
   * @returns 是否删除成功
   */
  async delete(id: string): Promise<boolean> {
    const document = await this.get(id);
    if (!document) {
      return false;
    }

    // 创建备份
    await this.createBackup(document);

    // 删除文件
    const filePath = this.getDocumentPath(id);
    await fs.unlink(filePath);

    // 从索引中移除
    await this.removeFromIndex(id);

    // 发送事件
    this.emitEvent('spec_deleted', id, { document });

    return true;
  }

  /**
   * 列出规格文档
   *
   * @param filters 过滤条件
   * @param sort 排序选项
   * @param pagination 分页选项
   * @returns 查询结果
   */
  async list(
    filters?: SpecFilters,
    sort?: SortOptions,
    pagination?: PaginationOptions
  ): Promise<QueryResult<SpecDocumentSummary>> {
    await this.ensureIndexLoaded();

    let specs = [...(this.index?.specs || [])];

    // 应用过滤器
    if (filters) {
      specs = this.applyFilters(specs, filters);
    }

    // 应用排序
    if (sort) {
      specs = this.applySorting(specs, sort);
    }

    // 计算分页
    const total = specs.length;
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const totalPages = Math.ceil(total / pageSize);

    // 应用分页
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = specs.slice(startIndex, endIndex);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // ===== 任务管理 =====

  /**
   * 添加任务到规格文档
   *
   * @param specId 文档 ID
   * @param request 任务创建请求
   * @returns 创建的任务或 null
   */
  async addTask(specId: string, request: CreateTaskRequest): Promise<SpecTask | null> {
    const document = await this.get(specId);
    if (!document) {
      return null;
    }

    const taskId = nanoid();
    const now = new Date();

    const task: SpecTask = {
      id: taskId,
      title: request.title,
      description: request.description,
      status: 'pending',
      priority: request.priority || 'medium',
      estimate: {
        hours: request.estimate?.hours || 1,
        confidence: request.estimate?.confidence || 0.5,
        notes: request.estimate?.notes,
      },
      dependencies: request.dependencies || [],
      assignee: request.assignee,
      tags: request.tags || [],
      createdAt: now,
      updatedAt: now,
      notes: '',
    };

    // 添加任务到文档
    document.tasks.push(task);
    document.metadata.updatedAt = now;

    // 保存文档
    await this.saveDocument(document);

    // 更新索引
    await this.updateIndex(document);

    // 发送事件
    this.emitEvent('task_created', specId, { task, taskId });

    return task;
  }

  /**
   * 更新任务
   *
   * @param specId 文档 ID
   * @param taskId 任务 ID
   * @param request 更新请求
   * @returns 更新后的任务或 null
   */
  async updateTask(
    specId: string,
    taskId: string,
    request: UpdateTaskRequest
  ): Promise<SpecTask | null> {
    const document = await this.get(specId);
    if (!document) {
      return null;
    }

    const taskIndex = document.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return null;
    }

    const task = document.tasks[taskIndex];
    const now = new Date();

    // 更新任务
    const updatedTask: SpecTask = {
      ...task,
      title: request.title ?? task.title,
      description: request.description ?? task.description,
      status: request.status ?? task.status,
      priority: request.priority ?? task.priority,
      estimate: request.estimate
        ? {
            ...task.estimate,
            ...request.estimate,
          }
        : task.estimate,
      dependencies: request.dependencies ?? task.dependencies,
      assignee: request.assignee ?? task.assignee,
      tags: request.tags ?? task.tags,
      notes: request.notes ?? task.notes,
      updatedAt: now,
      completedAt:
        request.status === 'completed' && task.status !== 'completed' ? now : task.completedAt,
    };

    // 更新文档中的任务
    document.tasks[taskIndex] = updatedTask;
    document.metadata.updatedAt = now;

    // 保存文档
    await this.saveDocument(document);

    // 更新索引
    await this.updateIndex(document);

    // 发送事件
    const eventType = request.status === 'completed' ? 'task_completed' : 'task_updated';
    this.emitEvent(eventType, specId, { task: updatedTask, taskId });

    return updatedTask;
  }

  /**
   * 删除任务
   *
   * @param specId 文档 ID
   * @param taskId 任务 ID
   * @returns 是否删除成功
   */
  async deleteTask(specId: string, taskId: string): Promise<boolean> {
    const document = await this.get(specId);
    if (!document) {
      return false;
    }

    const taskIndex = document.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return false;
    }

    const task = document.tasks[taskIndex];

    // 移除任务
    document.tasks.splice(taskIndex, 1);
    document.metadata.updatedAt = new Date();

    // 保存文档
    await this.saveDocument(document);

    // 更新索引
    await this.updateIndex(document);

    // 发送事件
    this.emitEvent('task_deleted', specId, { task, taskId });

    return true;
  }

  // ===== 导出功能 =====

  /**
   * 导出规格文档
   *
   * @param id 文档 ID
   * @param options 导出选项
   * @returns 导出内容
   */
  async export(id: string, options: ExportOptions): Promise<string> {
    const document = await this.get(id);
    if (!document) {
      throw new Error(`文档不存在: ${id}`);
    }

    switch (options.format) {
      case 'json':
        return this.exportToJson(document, options);
      case 'markdown':
        return this.exportToMarkdown(document, options);
      case 'html':
        return this.exportToHtml(document, options);
      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  // ===== 私有方法 =====

  /**
   * 确保目录存在
   */
  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.storage.specsDir, { recursive: true });
    await fs.mkdir(this.storage.backupDir, { recursive: true });
  }

  /**
   * 获取文档文件路径
   */
  private getDocumentPath(id: string): string {
    return join(this.storage.specsDir, `${id}.md`);
  }

  /**
   * 保存文档到文件系统
   */
  private async saveDocument(document: SpecDocument): Promise<void> {
    const filePath = this.getDocumentPath(document.id);
    const content = SpecParser.serialize(document);

    // 原子写入
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  /**
   * 创建备份
   */
  private async createBackup(document: SpecDocument): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(this.storage.backupDir, `${document.id}-${timestamp}.md`);
    const content = SpecParser.serialize(document);

    await fs.writeFile(backupPath, content, 'utf-8');
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.storage.indexFile, 'utf-8');
      const data = JSON.parse(content);

      // 恢复日期对象
      this.index = {
        ...data,
        lastUpdated: new Date(data.lastUpdated),
        specs: data.specs.map((spec: any) => ({
          ...spec,
          createdAt: new Date(spec.createdAt),
          updatedAt: new Date(spec.updatedAt),
        })),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 索引文件不存在，创建新索引
        this.index = {
          specs: [],
          lastUpdated: new Date(),
          version: '1.0.0',
        };
        await this.saveIndex();
      } else {
        throw error;
      }
    }

    this.indexLoaded = true;
  }

  /**
   * 保存索引
   */
  private async saveIndex(): Promise<void> {
    if (!this.index) return;

    const data = {
      ...this.index,
      lastUpdated: this.index.lastUpdated.toISOString(),
      specs: this.index.specs.map((spec) => ({
        ...spec,
        createdAt: spec.createdAt.toISOString(),
        updatedAt: spec.updatedAt.toISOString(),
      })),
    };

    await fs.writeFile(this.storage.indexFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 更新索引
   */
  private async updateIndex(document: SpecDocument): Promise<void> {
    if (!this.index) return;

    const summary: SpecDocumentSummary = {
      id: document.id,
      title: document.title,
      description: document.description,
      version: document.version,
      status: document.status,
      taskCount: document.tasks.length,
      completedTaskCount: document.tasks.filter((t) => t.status === 'completed').length,
      createdAt: document.metadata.createdAt,
      updatedAt: document.metadata.updatedAt,
      author: document.metadata.author,
      tags: document.metadata.tags,
    };

    const existingIndex = this.index.specs.findIndex((s) => s.id === document.id);
    if (existingIndex >= 0) {
      this.index.specs[existingIndex] = summary;
    } else {
      this.index.specs.push(summary);
    }

    this.index.lastUpdated = new Date();
    await this.saveIndex();
  }

  /**
   * 从索引中移除文档
   */
  private async removeFromIndex(id: string): Promise<void> {
    if (!this.index) return;

    this.index.specs = this.index.specs.filter((s) => s.id !== id);
    this.index.lastUpdated = new Date();
    await this.saveIndex();
  }

  /**
   * 确保索引已加载
   */
  private async ensureIndexLoaded(): Promise<void> {
    if (!this.indexLoaded) {
      await this.loadIndex();
    }
  }

  /**
   * 验证索引完整性
   */
  private async validateIndex(): Promise<void> {
    // 简单的完整性检查，可以扩展
    if (!this.index) {
      throw new Error('索引未加载');
    }
  }

  /**
   * 应用过滤器
   */
  private applyFilters(specs: SpecDocumentSummary[], filters: SpecFilters): SpecDocumentSummary[] {
    return specs.filter((spec) => {
      if (filters.status && !filters.status.includes(spec.status)) {
        return false;
      }

      if (filters.tags && !filters.tags.some((tag) => spec.tags.includes(tag))) {
        return false;
      }

      if (filters.author && spec.author !== filters.author) {
        return false;
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !spec.title.toLowerCase().includes(searchLower) &&
          !spec.description.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      if (filters.createdAfter && spec.createdAt < filters.createdAfter) {
        return false;
      }

      if (filters.createdBefore && spec.createdAt > filters.createdBefore) {
        return false;
      }

      return true;
    });
  }

  /**
   * 应用排序
   */
  private applySorting(specs: SpecDocumentSummary[], sort: SortOptions): SpecDocumentSummary[] {
    return [...specs].sort((a, b) => {
      let comparison = 0;

      switch (sort.field) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'version':
          comparison = a.version.localeCompare(b.version);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return sort.direction === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * 发送事件
   */
  private emitEvent(type: SpecEventType, specId: string, data: any): void {
    const event: SpecEvent = {
      type,
      specId,
      taskId: data.taskId,
      timestamp: new Date(),
      data,
    };

    this.eventBus.emit('spec_event', event);
  }

  /**
   * 获取默认内容
   */
  private getDefaultContent(title: string): string {
    return `# ${title}

## Overview

请在此处添加项目概述...

## Requirements

### Functional Requirements
- 功能需求1
- 功能需求2

### Non-Functional Requirements
- 性能要求
- 安全要求

## Architecture

请在此处添加架构设计...

## Implementation Plan

请在此处添加实施计划...
`;
  }

  /**
   * 导出为 Markdown
   */
  private exportToMarkdown(document: SpecDocument, options: ExportOptions): string {
    if (options.includeTasks && document.tasks.length > 0) {
      // 如果需要包含任务，则在内容中添加任务部分
      const documentWithTasks = {
        ...document,
        content: this.addTasksToContent(document.content, document.tasks),
      };
      return SpecParser.serialize(documentWithTasks);
    }
    return SpecParser.serialize(document);
  }

  /**
   * 导出为 JSON
   */
  private exportToJson(document: SpecDocument, options: ExportOptions): string {
    const exportData: any = {
      id: document.id,
      title: document.title,
      description: document.description,
      version: document.version,
      status: document.status,
      content: document.content,
    };

    if (options.includeTasks) {
      exportData.tasks = document.tasks;
    }

    if (options.includeMetadata) {
      exportData.metadata = document.metadata;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出为 HTML
   */
  private exportToHtml(document: SpecDocument, _options: ExportOptions): string {
    // 简单的 HTML 导出实现
    const markdown = this.exportToMarkdown(document, _options);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${document.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .task { margin: 10px 0; }
        .task-completed { text-decoration: line-through; color: #666; }
    </style>
</head>
<body>
    <pre>${markdown}</pre>
</body>
</html>`;
  }

  /**
   * 在内容中添加任务部分
   */
  private addTasksToContent(content: string, tasks: SpecTask[]): string {
    const taskSection =
      '\n\n## Tasks\n\n' +
      tasks
        .map((task) => {
          const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
          return `- ${checkbox} ${task.title}`;
        })
        .join('\n');

    return content + taskSection;
  }
}
