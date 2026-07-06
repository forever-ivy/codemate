import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ListFilesTool } from '../../../src/tools/file/ListFilesTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('ListFilesTool', () => {
  let tool: ListFilesTool;
  const testDir = path.join(process.cwd(), 'test-list-dir');

  beforeEach(async () => {
    tool = new ListFilesTool();

    // 创建测试目录和文件
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
    await fs.mkdir(path.join(testDir, 'subdir'));
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // 忽略错误
    }
  });

  /**
   * 测试 1：应该有正确的元数据
   */
  it('should have correct metadata', () => {
    expect(tool.name).toBe('list_files');
    expect(tool.description).toBeTruthy();
    expect(tool.schema).toBeDefined();
  });

  /**
   * 测试 2：应该能列出文件和目录
   */
  it('should list files and directories', async () => {
    const result = await tool.execute({ path: testDir });

    expect(result.files).toHaveLength(3);

    // 验证文件
    const file1 = result.files.find((f) => f.name === 'file1.txt');
    expect(file1).toBeDefined();
    expect(file1?.type).toBe('file');

    const file2 = result.files.find((f) => f.name === 'file2.txt');
    expect(file2).toBeDefined();
    expect(file2?.type).toBe('file');

    // 验证目录
    const subdir = result.files.find((f) => f.name === 'subdir');
    expect(subdir).toBeDefined();
    expect(subdir?.type).toBe('directory');
  });

  /**
   * 测试 3：应该处理空目录
   */
  it('should handle empty directory', async () => {
    const emptyDir = path.join(testDir, 'empty');
    await fs.mkdir(emptyDir);

    const result = await tool.execute({ path: emptyDir });

    expect(result.files).toHaveLength(0);
  });

  /**
   * 测试 4：应该处理不存在的目录
   */
  it('should handle non-existent directory', async () => {
    await expect(tool.execute({ path: 'non-existent-dir' })).rejects.toThrow(
      'Failed to list files'
    );
  });

  /**
   * 测试 5：应该验证输入
   */
  it('should validate input', () => {
    expect(() => {
      tool.validate({ path: 123 });
    }).toThrow();

    expect(() => {
      tool.validate({});
    }).toThrow();
  });
});
