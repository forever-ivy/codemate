import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileHistory } from '../../../src/snapshot/FileHistory';
import { Paths } from '../../../src/services/Paths';
import { EventBus } from '../../../src/services/EventBus';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('FileHistory', () => {
  let fileHistory: FileHistory;
  let testDir: string;

  beforeEach(async () => {
    const paths = new Paths({ productName: 'aicli', cwd: process.cwd() });
    const eventBus = new EventBus();
    fileHistory = new FileHistory(paths, eventBus);

    // 创建测试目录
    testDir = path.join(process.cwd(), 'test-snapshots');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略错误
    }
  });

  it('should track files', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello', 'utf-8');

    await fileHistory.trackFile(filePath);

    const snapshot = await fileHistory.createSnapshot('msg-1');
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0].path).toBe(filePath);
    expect(snapshot.files[0].content).toBe('Hello');
  });

  it('should create snapshots', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello', 'utf-8');
    await fileHistory.trackFile(filePath);

    const snapshot = await fileHistory.createSnapshot('msg-1', 'Test snapshot');

    expect(snapshot.id).toBeDefined();
    expect(snapshot.id).toMatch(/^snapshot-/);
    expect(snapshot.messageId).toBe('msg-1');
    expect(snapshot.description).toBe('Test snapshot');
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.timestamp).toBeInstanceOf(Date);
  });

  it('should list snapshots in reverse order', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Version 1', 'utf-8');
    await fileHistory.trackFile(filePath);
    const snapshot1 = await fileHistory.createSnapshot('msg-1');

    await fs.writeFile(filePath, 'Version 2', 'utf-8');
    await fileHistory.trackFile(filePath);
    const snapshot2 = await fileHistory.createSnapshot('msg-2');

    const snapshots = fileHistory.listSnapshots();
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].id).toBe(snapshot2.id); // 最新的在前
    expect(snapshots[1].id).toBe(snapshot1.id);
  });

  it('should rewind to snapshot', async () => {
    const filePath = path.join(testDir, 'test.txt');

    // 创建初始版本
    await fs.writeFile(filePath, 'Version 1', 'utf-8');
    await fileHistory.trackFile(filePath);
    const snapshot1 = await fileHistory.createSnapshot('msg-1');

    // 修改文件
    await fs.writeFile(filePath, 'Version 2', 'utf-8');

    // 回退
    await fileHistory.rewindTo(snapshot1.id);

    // 验证
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('Version 1');
  });

  it('should preview rewind', async () => {
    const filePath = path.join(testDir, 'test.txt');

    await fs.writeFile(filePath, 'Version 1', 'utf-8');
    await fileHistory.trackFile(filePath);
    const snapshot1 = await fileHistory.createSnapshot('msg-1');

    await fs.writeFile(filePath, 'Version 2', 'utf-8');

    const diffs = await fileHistory.previewRewind(snapshot1.id);

    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe(filePath);
    expect(diffs[0].oldContent).toBe('Version 2');
    expect(diffs[0].newContent).toBe('Version 1');
    expect(diffs[0].changes).toContain('- Version 2');
    expect(diffs[0].changes).toContain('+ Version 1');
  });

  it('should handle multiple files', async () => {
    const file1 = path.join(testDir, 'file1.txt');
    const file2 = path.join(testDir, 'file2.txt');

    await fs.writeFile(file1, 'Content 1', 'utf-8');
    await fs.writeFile(file2, 'Content 2', 'utf-8');

    await fileHistory.trackFile(file1);
    await fileHistory.trackFile(file2);

    const snapshot = await fileHistory.createSnapshot('msg-1');

    expect(snapshot.files).toHaveLength(2);
  });

  it('should clear tracked files after snapshot', async () => {
    const filePath = path.join(testDir, 'test.txt');
    await fs.writeFile(filePath, 'Hello', 'utf-8');

    await fileHistory.trackFile(filePath);
    await fileHistory.createSnapshot('msg-1');

    // 创建第二个快照，不应该包含之前的文件
    const snapshot2 = await fileHistory.createSnapshot('msg-2');
    expect(snapshot2.files).toHaveLength(0);
  });
});
