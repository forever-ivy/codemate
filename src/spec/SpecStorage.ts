import { promises as fs } from 'node:fs';
import { join } from 'pathe';
import type { SpecDocument, SpecDocumentSummary } from './types.js';
import { SpecParser } from './SpecParser.js';

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份文件名 */
  filename: string;
  /** 文档ID */
  specId: string;
  /** 备份时间 */
  timestamp: Date;
  /** 文件大小（字节） */
  size: number;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  /** 文档总数 */
  totalDocuments: number;
  /** 总存储大小（字节） */
  totalSize: number;
  /** 备份文件数量 */
  backupCount: number;
  /** 备份总大小（字节） */
  backupSize: number;
}

/**
 * SpecStorage - Spec 文档存储服务
 *
 * 职责：
 * 1. 文件系统操作
 * 2. 备份管理
 * 3. 索引管理
 * 4. 存储统计
 */
export class SpecStorage {
  constructor(
    private specsDir: string,
    private backupDir: string,
    private indexFile: string
  ) {}

  // ===== 文档操作 =====

  /**
   * 保存文档
   *
   * @param document 文档对象
   */
  async saveDocument(document: SpecDocument): Promise<void> {
    const filePath = this.getDocumentPath(document.id);
    const content = SpecParser.serialize(document);

    // 原子写入操作
    await this.atomicWrite(filePath, content);
  }

  /**
   * 加载文档
   *
   * @param id 文档ID
   * @returns 文档内容或null
   */
  async loadDocument(id: string): Promise<string | null> {
    try {
      const filePath = this.getDocumentPath(id);
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 删除文档
   *
   * @param id 文档ID
   */
  async deleteDocument(id: string): Promise<void> {
    const filePath = this.getDocumentPath(id);
    await fs.unlink(filePath);
  }

  /**
   * 检查文档是否存在
   *
   * @param id 文档ID
   * @returns 是否存在
   */
  async documentExists(id: string): Promise<boolean> {
    try {
      const filePath = this.getDocumentPath(id);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出所有文档ID
   *
   * @returns 文档ID列表
   */
  async listDocumentIds(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.specsDir);
      return files.filter((file) => file.endsWith('.md')).map((file) => file.slice(0, -3)); // 移除 .md 扩展名
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  // ===== 备份管理 =====

  /**
   * 创建备份
   *
   * @param document 文档对象
   * @returns 备份文件名
   */
  async createBackup(document: SpecDocument): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${document.id}-${timestamp}.md`;
    const backupPath = join(this.backupDir, filename);
    const content = SpecParser.serialize(document);

    await fs.writeFile(backupPath, content, 'utf-8');
    return filename;
  }

  /**
   * 列出备份文件
   *
   * @param specId 可选的文档ID，如果提供则只返回该文档的备份
   * @returns 备份信息列表
   */
  async listBackups(specId?: string): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        // 解析文件名：specId-timestamp.md
        const match = file.match(/^(.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.md$/);
        if (!match) continue;

        const [, fileSpecId, timestampStr] = match;

        // 如果指定了specId，则过滤
        if (specId && fileSpecId !== specId) continue;

        try {
          const timestamp = new Date(
            timestampStr.replace(/-/g, ':').replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3')
          );
          const filePath = join(this.backupDir, file);
          const stats = await fs.stat(filePath);

          backups.push({
            filename: file,
            specId: fileSpecId,
            timestamp,
            size: stats.size,
          });
        } catch {
          // 忽略无法解析的文件
        }
      }

      // 按时间倒序排列
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * 恢复备份
   *
   * @param filename 备份文件名
   * @returns 恢复的文档对象
   */
  async restoreBackup(filename: string): Promise<SpecDocument> {
    const backupPath = join(this.backupDir, filename);
    const content = await fs.readFile(backupPath, 'utf-8');

    // 从文件名提取文档ID
    const match = filename.match(/^(.+)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/);
    if (!match) {
      throw new Error(`无效的备份文件名: ${filename}`);
    }

    const specId = match[1];
    const parseResult = SpecParser.parse(content, specId);

    if (!parseResult.success || !parseResult.document) {
      throw new Error(`备份文件解析失败: ${parseResult.errors.join(', ')}`);
    }

    return parseResult.document;
  }

  /**
   * 删除备份
   *
   * @param filename 备份文件名
   */
  async deleteBackup(filename: string): Promise<void> {
    const backupPath = join(this.backupDir, filename);
    await fs.unlink(backupPath);
  }

  /**
   * 清理旧备份
   *
   * @param specId 文档ID
   * @param keepCount 保留的备份数量
   */
  async cleanupBackups(specId: string, keepCount: number = 10): Promise<void> {
    const backups = await this.listBackups(specId);

    if (backups.length <= keepCount) {
      return;
    }

    // 删除多余的备份（保留最新的keepCount个）
    const toDelete = backups.slice(keepCount);

    for (const backup of toDelete) {
      await this.deleteBackup(backup.filename);
    }
  }

  // ===== 索引管理 =====

  /**
   * 保存索引
   *
   * @param index 索引数据
   */
  async saveIndex(index: any): Promise<void> {
    const content = JSON.stringify(index, null, 2);
    await this.atomicWrite(this.indexFile, content);
  }

  /**
   * 加载索引
   *
   * @returns 索引数据或null
   */
  async loadIndex(): Promise<any | null> {
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 重建索引
   *
   * @returns 重建的索引
   */
  async rebuildIndex(): Promise<{
    specs: SpecDocumentSummary[];
    lastUpdated: Date;
    version: string;
  }> {
    const documentIds = await this.listDocumentIds();
    const specs: SpecDocumentSummary[] = [];

    for (const id of documentIds) {
      try {
        const content = await this.loadDocument(id);
        if (!content) continue;

        const parseResult = SpecParser.parse(content, id);
        if (!parseResult.success || !parseResult.document) continue;

        const doc = parseResult.document;
        specs.push({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          version: doc.version,
          status: doc.status,
          taskCount: doc.tasks.length,
          completedTaskCount: doc.tasks.filter((t) => t.status === 'completed').length,
          createdAt: doc.metadata.createdAt,
          updatedAt: doc.metadata.updatedAt,
          author: doc.metadata.author,
          tags: doc.metadata.tags,
        });
      } catch (error) {
        console.warn(`跳过损坏的文档 ${id}:`, error);
      }
    }

    const index = {
      specs,
      lastUpdated: new Date(),
      version: '1.0.0',
    };

    await this.saveIndex(index);
    return index;
  }

  /**
   * 验证索引完整性
   *
   * @returns 验证结果
   */
  async validateIndex(): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const index = await this.loadIndex();
      if (!index) {
        errors.push('索引文件不存在');
        return { isValid: false, errors, warnings };
      }

      if (!Array.isArray(index.specs)) {
        errors.push('索引格式无效：specs 不是数组');
        return { isValid: false, errors, warnings };
      }

      // 检查索引中的文档是否存在
      const documentIds = await this.listDocumentIds();
      const indexedIds = new Set(index.specs.map((spec: any) => spec.id));

      // 检查索引中有但文件系统中没有的文档
      for (const spec of index.specs) {
        if (!documentIds.includes(spec.id)) {
          warnings.push(`索引中的文档 ${spec.id} 在文件系统中不存在`);
        }
      }

      // 检查文件系统中有但索引中没有的文档
      for (const id of documentIds) {
        if (!indexedIds.has(id)) {
          warnings.push(`文件系统中的文档 ${id} 不在索引中`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`验证索引时出错: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, errors, warnings };
    }
  }

  // ===== 存储统计 =====

  /**
   * 获取存储统计信息
   *
   * @returns 统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    const documentIds = await this.listDocumentIds();
    const backups = await this.listBackups();

    let totalSize = 0;
    let backupSize = 0;

    // 计算文档总大小
    for (const id of documentIds) {
      try {
        const filePath = this.getDocumentPath(id);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch {
        // 忽略无法访问的文件
      }
    }

    // 计算备份总大小
    for (const backup of backups) {
      backupSize += backup.size;
    }

    return {
      totalDocuments: documentIds.length,
      totalSize,
      backupCount: backups.length,
      backupSize,
    };
  }

  // ===== 工具方法 =====

  /**
   * 确保目录存在
   */
  async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.specsDir, { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });

    // 确保索引文件的目录存在
    const indexDir = join(this.indexFile, '..');
    await fs.mkdir(indexDir, { recursive: true });
  }

  /**
   * 获取文档文件路径
   */
  private getDocumentPath(id: string): string {
    return join(this.specsDir, `${id}.md`);
  }

  /**
   * 原子写入文件
   *
   * @param filePath 文件路径
   * @param content 文件内容
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp`;

    try {
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // 清理临时文件
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }
}
