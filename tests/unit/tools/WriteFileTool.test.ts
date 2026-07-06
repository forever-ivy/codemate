import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WriteFileTool } from '../../../src/tools/file/WriteFileTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  const testDir = path.join(process.cwd(), 'test-write-dir');
  const testFile = path.join(testDir, 'test.txt');

  beforeEach(() => {
    tool = new WriteFileTool();
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
    expect(tool.name).toBe('write_file');
    expect(tool.description).toBeTruthy();
    expect(tool.schema).toBeDefined();
  });

  /**
   * 测试 2：应该能写入文件
   */
  it('should write file content', async () => {
    const content = 'Hello, World!';

    const result = await tool.execute({
      path: testFile,
      content,
    });

    // 验证返回值
    expect(result.success).toBe(true);
    expect(result.bytesWritten).toBe(Buffer.byteLength(content, 'utf-8'));

    // 验证文件内容
    const fileContent = await fs.readFile(testFile, 'utf-8');
    expect(fileContent).toBe(content);
  });

  /**
   * 测试 3：应该能创建不存在的目录
   */
  it('should create directory if not exists', async () => {
    const nestedFile = path.join(testDir, 'nested', 'deep', 'test.txt');
    const content = 'Nested file';

    const result = await tool.execute({
      path: nestedFile,
      content,
    });

    expect(result.success).toBe(true);

    // 验证文件存在
    const fileContent = await fs.readFile(nestedFile, 'utf-8');
    expect(fileContent).toBe(content);
  });

  /**
   * 测试 4：应该能覆盖现有文件
   */
  it('should overwrite existing file', async () => {
    // 先写入一次
    await tool.execute({
      path: testFile,
      content: 'First content',
    });

    // 再写入一次
    const newContent = 'Second content';
    const result = await tool.execute({
      path: testFile,
      content: newContent,
    });

    expect(result.success).toBe(true);

    // 验证内容被覆盖
    const fileContent = await fs.readFile(testFile, 'utf-8');
    expect(fileContent).toBe(newContent);
  });

  /**
   * 测试 5：应该验证输入
   */
  it('should validate input', () => {
    expect(() => {
      tool.validate({ path: 123 });
    }).toThrow();

    expect(() => {
      tool.validate({ content: 'test' });
    }).toThrow();
  });
});
