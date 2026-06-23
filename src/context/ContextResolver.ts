import type { ContextProvider, ContextCache, ContextReference } from '../types/index';

/**
 * ContextResolver - 上下文解析器
 *
 * 职责：
 * 1. 注册和管理 Provider
 * 2. 解析消息中的上下文引用
 * 3. 管理缓存
 * 4. 注入上下文到消息
 */
export class ContextResolver {
  private providers: Map<string, ContextProvider>;
  private cache: Map<string, ContextCache>;

  constructor() {
    this.providers = new Map();
    this.cache = new Map();

    console.log('✅ ContextResolver initialized');
  }

  /**
   * 注册 Provider
   *
   * @param provider 上下文提供者
   */
  register(provider: ContextProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`✅ Context provider registered: ${provider.name}`);
  }

  /**
   * 解析消息中的上下文引用
   *
   * 这是核心方法，处理整个解析流程
   *
   * @param message 用户消息
   * @param cwd 当前工作目录
   * @returns 注入上下文后的消息
   */
  async resolve(message: string, cwd: string): Promise<string> {
    // 1. 检测所有上下文引用
    const references = this.detectReferences(message);

    // 2. 如果没有引用，直接返回
    if (references.length === 0) {
      return message;
    }

    // 3. 解析所有引用
    const contexts: string[] = [];

    for (const ref of references) {
      try {
        const context = await this.resolveReference(ref, cwd);
        if (context) {
          contexts.push(context);
        }
      } catch (error) {
        console.error(`Failed to resolve ${ref.type}:`, error);
        // 继续处理其他引用
      }
    }

    // 4. 如果没有成功解析任何上下文，返回原消息
    if (contexts.length === 0) {
      return message;
    }

    // 5. 移除原消息中的引用标记
    let cleanedMessage = message;
    for (const ref of references) {
      cleanedMessage = cleanedMessage.replace(ref.originalText, '');
    }
    cleanedMessage = cleanedMessage.trim();

    // 6. 注入上下文
    const contextSection = contexts.join('\n\n---\n\n');
    const injectedMessage = `${contextSection}\n\n---\n\n${cleanedMessage}`;

    return injectedMessage;
  }

  /**
   * 检测消息中的所有上下文引用
   *
   * @param message 用户消息
   * @returns 引用列表
   */
  private detectReferences(message: string): ContextReference[] {
    const references: ContextReference[] = [];

    // 遍历所有 Provider
    for (const provider of this.providers.values()) {
      // 使用 Provider 的 pattern 匹配
      const matches = message.matchAll(new RegExp(provider.pattern, 'gi'));

      for (const match of matches) {
        references.push({
          type: provider.name,
          match: match as RegExpMatchArray,
          provider,
          originalText: match[0],
        });
      }
    }

    return references;
  }

  /**
   * 解析单个引用
   *
   * @param ref 引用信息
   * @param cwd 当前工作目录
   * @returns 解析后的上下文
   */
  private async resolveReference(ref: ContextReference, cwd: string): Promise<string | null> {
    // 1. 生成缓存键
    const cacheKey = ref.provider.getCacheKey
      ? ref.provider.getCacheKey(ref.match)
      : ref.provider.name;

    // 2. 检查缓存
    const cached = this.getCache(cacheKey);
    if (cached) {
      console.log(`📦 Using cached context: ${cacheKey}`);
      return cached.data;
    }

    // 3. 调用 Provider 解析
    console.log(`🔍 Resolving context: ${ref.type}`);
    const context = await ref.provider.resolve(ref.match, cwd);

    // 4. 缓存结果
    this.setCache(cacheKey, context, ref.provider.ttl);

    return context;
  }

  /**
   * 获取缓存
   *
   * @param key 缓存键
   * @returns 缓存项（如果有效）
   */
  private getCache(key: string): ContextCache | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // 过期，删除缓存
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * 设置缓存
   *
   * @param key 缓存键
   * @param data 数据
   * @param ttl 生存时间
   */
  private setCache(key: string, data: string, ttl: number): void {
    this.cache.set(key, {
      key,
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * 清除缓存
   *
   * @param key 缓存键（可选，不提供则清除所有）
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
      console.log(`🗑️  Cache cleared: ${key}`);
    } else {
      this.cache.clear();
      console.log('🗑️  All cache cleared');
    }
  }

  /**
   * 获取缓存统计
   *
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
