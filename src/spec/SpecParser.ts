import matter from 'gray-matter';
import type { SpecDocument, SpecTask, SpecMetadata, SpecStatus } from './types.js';

/**
 * 解析结果
 */
export interface ParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析后的文档 */
  document?: SpecDocument;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

/**
 * Frontmatter数据结构
 */
interface SpecFrontmatter {
  title?: string;
  description?: string;
  version?: string;
  status?: SpecStatus;
  author?: string;
  tags?: string[];
  projectPath?: string;
  relatedFiles?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  parentId?: string;
  branch?: string;
  tasks?: SpecTask[];
}

/**
 * SpecParser - Spec 文档解析器
 *
 * 职责：
 * 1. 解析 Markdown 格式的 Spec 文档
 * 2. 提取 frontmatter 元数据
 * 3. 解析任务信息
 * 4. 序列化文档为 Markdown
 */
export class SpecParser {
  private static readonly TASK_SECTION_REGEX = /^##\s+Tasks?\s*$/im;
  private static readonly TASK_ITEM_REGEX = /^-\s+\[([x\s])\]\s+(.+)$/gm;

  /**
   * 解析 Spec 文档
   *
   * @param content Markdown 内容
   * @param id 文档 ID
   * @returns 解析结果
   */
  static parse(content: string, id: string): ParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. 解析 frontmatter
      const { data: frontmatter, content: markdownContent } = matter(content);

      // 2. 验证和提取基本信息
      const basicInfo = this.extractBasicInfo(frontmatter as SpecFrontmatter, errors, warnings);

      // 3. 从 frontmatter 获取任务，如果没有则从 markdown 解析（向后兼容）
      let tasks: SpecTask[] = [];
      if (frontmatter.tasks && Array.isArray(frontmatter.tasks)) {
        // 从 frontmatter 恢复任务，确保日期对象正确
        tasks = frontmatter.tasks.map((task) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        }));
      } else {
        // 从 markdown 内容解析任务（向后兼容）
        tasks = this.parseTasks(markdownContent, errors, warnings);
      }

      // 4. 构建文档对象
      const document: SpecDocument = {
        id,
        title: basicInfo.title,
        description: basicInfo.description,
        version: basicInfo.version,
        status: basicInfo.status,
        content: markdownContent,
        tasks,
        metadata: basicInfo.metadata,
        parentId: basicInfo.parentId,
        branch: basicInfo.branch,
      };

      return {
        success: errors.length === 0,
        document,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`解析失败: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        errors,
        warnings,
      };
    }
  }

  /**
   * 序列化 Spec 文档为 Markdown
   *
   * @param document Spec 文档对象
   * @returns Markdown 字符串
   */
  static serialize(document: SpecDocument): string {
    const frontmatter = this.buildFrontmatter(document);
    const content = this.buildContent(document);

    return matter.stringify(content, frontmatter);
  }

  /**
   * 提取基本信息
   *
   * @param frontmatter frontmatter 数据
   * @param errors 错误列表
   * @param warnings 警告列表
   * @returns 基本信息
   */
  private static extractBasicInfo(
    frontmatter: SpecFrontmatter,
    errors: string[],
    warnings: string[]
  ) {
    // 验证必需字段
    if (!frontmatter.title) {
      errors.push('缺少必需字段: title');
    }

    if (!frontmatter.description) {
      warnings.push('建议添加描述字段: description');
    }

    // 解析日期
    const createdAt = this.parseDate(frontmatter.createdAt) || new Date();
    const updatedAt = this.parseDate(frontmatter.updatedAt) || new Date();

    // 构建元数据
    const metadata: SpecMetadata = {
      createdAt,
      updatedAt,
      author: frontmatter.author || 'unknown',
      tags: frontmatter.tags || [],
      projectPath: frontmatter.projectPath || process.cwd(),
      relatedFiles: frontmatter.relatedFiles || [],
    };

    return {
      title: frontmatter.title || 'Untitled Spec',
      description: frontmatter.description || '',
      version: frontmatter.version || '1.0.0',
      status: this.validateStatus(frontmatter.status) || 'draft',
      metadata,
      parentId: frontmatter.parentId,
      branch: frontmatter.branch,
    };
  }

  /**
   * 从 markdown 内容解析任务（向后兼容）
   *
   * @param content markdown 内容
   * @param _errors 错误列表
   * @param warnings 警告列表
   * @returns 任务列表
   */
  private static parseTasks(content: string, _errors: string[], warnings: string[]): SpecTask[] {
    const tasks: SpecTask[] = [];

    // 查找任务部分
    const taskSectionMatch = content.match(this.TASK_SECTION_REGEX);
    if (!taskSectionMatch) {
      warnings.push('未找到任务部分，建议添加 "## Tasks" 部分');
      return tasks;
    }

    // 提取任务部分内容
    const taskSectionStart = taskSectionMatch.index! + taskSectionMatch[0].length;
    const nextSectionMatch = content.slice(taskSectionStart).match(/^##\s+/m);
    const taskSectionEnd = nextSectionMatch
      ? taskSectionStart + nextSectionMatch.index!
      : content.length;

    const taskSection = content.slice(taskSectionStart, taskSectionEnd);

    // 解析任务项
    let match;
    let taskIndex = 0;
    while ((match = this.TASK_ITEM_REGEX.exec(taskSection)) !== null) {
      const isCompleted = match[1] === 'x';
      const title = match[2].trim();

      if (title) {
        const now = new Date();
        tasks.push({
          id: `task-${++taskIndex}`,
          title,
          description: '',
          status: isCompleted ? 'completed' : 'pending',
          priority: 'medium',
          estimate: { hours: 1, confidence: 0.5 },
          dependencies: [],
          tags: [],
          createdAt: now,
          updatedAt: now,
          notes: '',
        });
      }
    }

    return tasks;
  }

  /**
   * 构建 frontmatter
   *
   * @param document Spec 文档
   * @returns frontmatter 对象
   */
  private static buildFrontmatter(document: SpecDocument) {
    const frontmatter: Record<string, any> = {
      title: document.title,
      description: document.description,
      version: document.version,
      status: document.status,
      author: document.metadata.author,
      tags: document.metadata.tags,
      projectPath: document.metadata.projectPath,
      relatedFiles: document.metadata.relatedFiles,
      createdAt: document.metadata.createdAt.toISOString(),
      updatedAt: document.metadata.updatedAt.toISOString(),
      // 清理任务对象，移除undefined值
      tasks: document.tasks.map((task) => {
        const cleanTask: any = {
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          estimate: {
            hours: task.estimate.hours,
            confidence: task.estimate.confidence,
            ...(task.estimate.notes && { notes: task.estimate.notes }),
          },
          dependencies: task.dependencies,
          tags: task.tags,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          notes: task.notes,
        };

        // 只添加非空的可选字段
        if (task.assignee) {
          cleanTask.assignee = task.assignee;
        }

        if (task.completedAt) {
          cleanTask.completedAt = task.completedAt.toISOString();
        }

        return cleanTask;
      }),
    };

    // 只添加非空的可选字段
    if (document.parentId) {
      frontmatter.parentId = document.parentId;
    }

    if (document.branch) {
      frontmatter.branch = document.branch;
    }

    return frontmatter;
  }

  /**
   * 构建内容
   *
   * @param document Spec 文档
   * @returns Markdown 内容
   */
  private static buildContent(document: SpecDocument): string {
    // 返回原始内容，任务信息存储在 frontmatter 中
    return document.content;
  }

  // ===== 工具方法 =====

  /**
   * 解析日期
   */
  private static parseDate(dateValue: string | Date | undefined): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;

    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * 验证状态
   */
  private static validateStatus(status: string | undefined): SpecStatus | null {
    const validStatuses: SpecStatus[] = ['draft', 'review', 'approved', 'implemented', 'archived'];
    return validStatuses.includes(status as SpecStatus) ? (status as SpecStatus) : null;
  }
}
