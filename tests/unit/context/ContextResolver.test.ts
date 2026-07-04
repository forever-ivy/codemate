import { describe, it, expect, beforeEach } from 'vitest';
import { ContextResolver } from '../../../src/context/ContextResolver';
import { ContextProvider } from '../../../src/context/providers/ContextProvider';

// 模拟 Provider
class MockProvider extends ContextProvider {
  name = 'mock';
  pattern = /#Mock\b/i;
  ttl = 5000;

  async resolve(_match: RegExpMatchArray, _cwd: string): Promise<string> {
    return '## Mock Context\n\nThis is mock context.';
  }
}

describe('ContextResolver', () => {
  let resolver: ContextResolver;

  beforeEach(() => {
    resolver = new ContextResolver();
  });

  /**
   * 测试 1：应该正确注册 Provider
   */
  it('should register provider', async () => {
    const provider = new MockProvider();
    resolver.register(provider);

    // 验证：通过解析消息来确认注册成功
    const message = '#Mock test';
    const resolved = await resolver.resolve(message, process.cwd());

    expect(resolved).toContain('Mock Context');
  });

  /**
   * 测试 2：应该检测上下文引用
   */
  it('should detect context references', async () => {
    const provider = new MockProvider();
    resolver.register(provider);

    const message = 'Please #Mock help me';
    const resolved = await resolver.resolve(message, process.cwd());

    expect(resolved).toContain('Mock Context');
    expect(resolved).toContain('help me');
  });

  /**
   * 测试 3：应该使用缓存
   */
  it('should use cache', async () => {
    let callCount = 0;

    class CountingProvider extends ContextProvider {
      name = 'counting';
      pattern = /#Count\b/i;
      ttl = 5000;

      async resolve(): Promise<string> {
        callCount++;
        return 'counted';
      }
    }

    resolver.register(new CountingProvider());

    // 第一次调用
    await resolver.resolve('#Count', process.cwd());
    expect(callCount).toBe(1);

    // 第二次调用（应该使用缓存）
    await resolver.resolve('#Count', process.cwd());
    expect(callCount).toBe(1); // 没有增加
  });

  /**
   * 测试 4：应该清除缓存
   */
  it('should clear cache', async () => {
    const provider = new MockProvider();
    resolver.register(provider);

    // 解析一次（创建缓存）
    await resolver.resolve('#Mock', process.cwd());

    // 清除缓存
    resolver.clearCache();

    // 验证缓存已清除
    const stats = resolver.getCacheStats();
    expect(stats.size).toBe(0);
  });

  /**
   * 测试 5：应该处理没有引用的消息
   */
  it('should handle messages without references', async () => {
    const provider = new MockProvider();
    resolver.register(provider);

    const message = 'Hello world';
    const resolved = await resolver.resolve(message, process.cwd());

    expect(resolved).toBe(message);
  });
});
