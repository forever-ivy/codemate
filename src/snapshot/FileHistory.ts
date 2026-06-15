import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import * as crypto from 'node:crypto';
import type { Paths } from '../services/Paths';
import type { EventBus } from '../services/EventBus';
import type { Snapshot, FileSnapshot, Diff } from './types';

/**
 * FileHistory - 文件历史管理器
 *
 * 功能：
 * 1. 追踪文件变化
 * 2. 创建快照
 * 3. 回退到快照
 * 4. 预览回退效果
 */ export class FileHistory {
  private trackedFiles = new Set<string>(); // 追踪的文件列表
  private snapshots: Snapshot[] = []; // 快照列表
  private eventBus: EventBus;

  constructor(_paths: Paths, eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * 追踪文件
   *
   * 在修改文件前调用，记录需要追踪的文件
   */
  async trackFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    this.trackedFiles.add(absolutePath);
  }

  /**
   * 创建快照
   *
   * 读取所有追踪的文件，保存它们的当前状态
   */
  async createSnapshot(messageId: string, description?: string): Promise<Snapshot> {
    const files: FileSnapshot[] = [];

    // 读取所有追踪的文件
    for (const filePath of this.trackedFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = this.hashContent(content);

        files.push({
          path: filePath,
          content,
          hash,
        });
      } catch (error) {
        // 文件可能已被删除，跳过
        console.warn(`⚠️  File not found: ${filePath}`);
      }
    }

    // 创建快照
    const snapshot: Snapshot = {
      id: this.generateSnapshotId(),
      messageId,
      timestamp: new Date(),
      files,
      description,
    };

    this.snapshots.push(snapshot);
    this.eventBus.emit('snapshot.created', snapshot);

    // 隐藏快照创建日志，通过任务跟踪系统显示

    // 清空追踪列表（为下一次做准备）
    this.trackedFiles.clear();

    return snapshot;
  }

  /**
   * 列出快照
   *
   * 返回所有快照，最新的在前
   */
  listSnapshots(): Snapshot[] {
    return [...this.snapshots].reverse();
  }

  /**
   * 回退到快照
   *
   * 恢复快照中所有文件的内容
   */
  async rewindTo(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    console.log(`⏪ Rewinding to snapshot: ${snapshotId}`);

    // 恢复所有文件
    for (const file of snapshot.files) {
      await fs.writeFile(file.path, file.content, 'utf-8');
      console.log(`  ✅ Restored: ${file.path}`);
    }

    this.eventBus.emit('snapshot.rewound', snapshot);

    console.log('✅ Rewind complete');
  }

  /**
   * 预览回退
   *
   * 显示回退后的变化，但不实际修改文件
   */
  async previewRewind(snapshotId: string): Promise<Diff[]> {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);

    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const diffs: Diff[] = [];

    for (const file of snapshot.files) {
      try {
        const currentContent = await fs.readFile(file.path, 'utf-8');

        // 只有内容不同才添加到 diff
        if (currentContent !== file.content) {
          diffs.push({
            path: file.path,
            oldContent: currentContent,
            newContent: file.content,
            changes: this.generateDiff(currentContent, file.content),
          });
        }
      } catch (error) {
        // 文件可能已被删除
        diffs.push({
          path: file.path,
          oldContent: '',
          newContent: file.content,
          changes: 'File will be restored',
        });
      }
    }

    return diffs;
  }

  /**
   * 生成内容哈希
   *
   * 使用 SHA-256 算法
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 生成快照 ID
   *
   * 格式：snapshot-2024-03-02T10-30-45-a1b2
   */
  private generateSnapshotId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const random = Math.random().toString(36).substring(2, 6);
    return `snapshot-${timestamp}-${random}`;
  }

  /**
   * 生成 Diff
   *
   * 简单的行级 diff
   */
  private generateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine !== newLine) {
        if (oldLine !== undefined) {
          diff.push(`- ${oldLine}`);
        }
        if (newLine !== undefined) {
          diff.push(`+ ${newLine}`);
        }
      }
    }

    return diff.join('\n');
  }
}
