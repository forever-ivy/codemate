import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContextResolver } from '../../src/context/ContextResolver';
import { FileProvider } from '../../src/context/providers/FileProvider';
import { FolderProvider } from '../../src/context/providers/FolderProvider';
import * as fs from 'node:fs';
import * as path from 'pathe';

describe('Context Reference Integration', () => {
  const testDir = path.join(process.cwd(), 'test-context');

  beforeEach(() => {
    // 创建测试目录和文件
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(testDir, 'test.ts'),
      'export function hello() {\n  return "world";\n}'
    );
  });

  afterEach(() => {
    // 清理测试目录
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  /**
   * 测试 1：应该解析文件引用
   */
  it('should resolve file reference', async () => {
    const resolver = new ContextResolver();
    resolver.register(new FileProvider());

    const message = '#File test.ts help me optimize this';
    const resolved = await resolver.resolve(message, testDir);

    expect(resolved).toContain('File: test.ts');
    expect(resolved).toContain('export function hello');
    expect(resolved).toContain('help me optimize this');
  });

  /**
   * 测试 2：应该解析目录引用
   */
  it('should resolve folder reference', async () => {
    const resolver = new ContextResolver();
    resolver.register(new FolderProvider());

    const message = '#Folder . show me the structure';
    const resolved = await resolver.resolve(message, testDir);

    expect(resolved).toContain('Folder: .');
    expect(resolved).toContain('test.ts');
  });

  /**
   * 测试 3：应该处理多个引用
   */
  it('should handle multiple references', async () => {
    const resolver = new ContextResolver();
    resolver.register(new FileProvider());
    resolver.register(new FolderProvider());

    const message = '#Folder . #File test.ts analyze this project';
    const resolved = await resolver.resolve(message, testDir);

    expect(resolved).toContain('Folder: .');
    expect(resolved).toContain('File: test.ts');
    expect(resolved).toContain('analyze this project');
  });

  /**
   * 测试 4：应该处理不存在的文件
   */
  it('should handle non-existent file', async () => {
    const resolver = new ContextResolver();
    resolver.register(new FileProvider());

    const message = '#File nonexistent.ts help me';
    const resolved = await resolver.resolve(message, testDir);

    expect(resolved).toContain('File not found');
  });
});
