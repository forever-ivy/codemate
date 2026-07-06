import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReadFileTool } from '@/tools/file/ReadFileTool';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  const testFile = path.join(process.cwd(), 'test-read-file.txt');
  const testContent = 'Hello, AICLI!';

  beforeEach(async () => {
    tool = new ReadFileTool();
    // 创建测试文件
    await fs.writeFile(testFile, testContent, 'utf-8');
  });

  afterEach(async () => {
    // 清理测试文件
    try {
      await fs.unlink(testFile);
    } catch {
      // 忽略错误
    }
  });

  /**
   * 测试 1：应该有正确的元数据
   */
  it('should have correct metadata', () => {
    expect(tool.name).toBe('read_file');
    expect(tool.description).toBeTruthy();
  });

  /**
   * 测试 2：应该能读取文件
   */
  it('should read file content', async () => {
    const result = await tool.execute({ path: testFile });

    expect(result.content).toBe(testContent);
    expect(result.size).toBe(testContent.length);
  });

  /**
   * 测试 3：应该能验证输入
   */
  it('should validate input', () => {
    // 有效输入
    expect(() => tool.validate({ path: 'test.txt' })).not.toThrow();

    // 无效输入
    expect(() => tool.validate({ path: 123 })).toThrow();
    expect(() => tool.validate({})).toThrow();
  });

  /**
   * 测试 4：应该处理文件不存在的情况
   */
  it('should handle file not found', async () => {
    await expect(tool.execute({ path: 'non-existent-file.txt' })).rejects.toThrow('File not found');
  });

  /**
   * 测试 5：应该支持相对路径
   */
  it('should support relative paths', async () => {
    const result = await tool.execute({ path: 'test-read-file.txt' });
    expect(result.content).toBe(testContent);
  });
});
