import type {
  CacheEntry,
  CacheStrategy,
  PreloadTask,
  PreloadOptions,
  OptimizationResult,
  MemoryUsage,
} from './types.js';

/**
 * 缓存服务
 *
 * 职责：
 * 1. 智能缓存管理
 * 2. 数据预加载
 * 3. 缓存失效策略
 * 4. 性能监控和优化
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private preloadQueue: PreloadTask[] = [];
  private strategy: CacheStrategy = 'lru';
  private maxSize = 100; // MB
  private defaultTtl = 3600; // 1小时
  private hitCount = 0;
  private missCount = 0;
  private initialized = false;

  /**
   * 初始化缓存服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🗄️  初始化缓存服务...');

    // 设置定期清理
    this.setupPeriodicCleanup();

    // 设置内存监控
    this.setupMemoryMonitoring();

    this.initialized = true;
    console.log('✅ 缓存服务初始化完成');
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // 更新访问信息
    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    this.hitCount++;

    return entry.value as T;
  }

  /**
   * 设置缓存数据
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const now = new Date();
    const effectiveTtl = ttl || this.defaultTtl;
    const size = this.calculateSize(value);

    // 检查缓存容量
    await this.ensureCapacity(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      expiresAt: new Date(now.getTime() + effectiveTtl * 1000),
      size,
    };

    this.cache.set(key, entry);
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  /**
   * 批量失效缓存
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    console.log(`🗑️  失效缓存: ${keysToDelete.length} 个条目 (模式: ${pattern})`);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    const count = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    console.log(`🗑️  清空缓存: ${count} 个条目`);
  }

  /**
   * 预加载数据
   */
  async preload(tasks: PreloadTask[]): Promise<void> {
    console.log(`🔄 开始预加载 ${tasks.length} 个任务...`);

    // 按优先级排序
    const sortedTasks = tasks.sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      try {
        await this.executePreloadTask(task);
      } catch (error) {
        console.warn(`⚠️  预加载任务失败: ${task.id}`, error);
      }
    }

    console.log('✅ 预加载完成');
  }

  /**
   * 项目数据预热
   */
  async warmup(projectId: string): Promise<void> {
    console.log(`🔥 开始项目数据预热: ${projectId}`);

    const preloadTasks: PreloadTask[] = [
      {
        id: `spec-${projectId}`,
        type: 'spec',
        resourceId: projectId,
        priority: 10,
        options: {
          includeRelated: true,
          depth: 2,
          cacheDuration: 7200, // 2小时
        },
      },
      {
        id: `plan-${projectId}`,
        type: 'plan',
        resourceId: projectId,
        priority: 8,
        options: {
          includeRelated: true,
          depth: 1,
          cacheDuration: 3600, // 1小时
        },
      },
      {
        id: `execution-${projectId}`,
        type: 'execution',
        resourceId: projectId,
        priority: 6,
        options: {
          includeRelated: false,
          depth: 1,
          cacheDuration: 1800, // 30分钟
        },
      },
    ];

    await this.preload(preloadTasks);
  }

  /**
   * 获取缓存命中率
   */
  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): MemoryUsage {
    let totalSize = 0;
    const breakdown = new Map<string, number>();

    for (const entry of this.cache.values()) {
      totalSize += entry.size;

      const category = this.getCacheCategory(entry.key);
      const currentSize = breakdown.get(category) || 0;
      breakdown.set(category, currentSize + entry.size);
    }

    return {
      used: totalSize / (1024 * 1024), // 转换为MB
      total: this.maxSize,
      percentage: (totalSize / (1024 * 1024) / this.maxSize) * 100,
      breakdown,
    };
  }

  /**
   * 优化缓存性能
   */
  async optimize(): Promise<OptimizationResult> {
    const beforeMetrics = this.getMemoryUsage();
    const beforeHitRate = this.getHitRate();

    console.log('🔧 开始缓存优化...');

    // 1. 清理过期条目
    await this.cleanupExpired();

    // 2. 根据策略清理低价值条目
    await this.cleanupByStrategy();

    // 3. 优化预加载策略
    await this.optimizePreloadStrategy();

    const afterMetrics = this.getMemoryUsage();
    const afterHitRate = this.getHitRate();

    const memoryImprovement = ((beforeMetrics.used - afterMetrics.used) / beforeMetrics.used) * 100;
    const hitRateImprovement = ((afterHitRate - beforeHitRate) / beforeHitRate) * 100;

    const result: OptimizationResult = {
      type: 'cache',
      before: {
        memoryUsage: beforeMetrics.used,
        responseTime: 0, // 简化
      } as any,
      after: {
        memoryUsage: afterMetrics.used,
        responseTime: 0, // 简化
      } as any,
      improvement: Math.max(memoryImprovement, hitRateImprovement),
      recommendations: this.generateOptimizationRecommendations(beforeMetrics, afterMetrics),
      optimizedAt: new Date(),
    };

    console.log(`✅ 缓存优化完成，内存节省 ${memoryImprovement.toFixed(1)}%`);
    return result;
  }

  /**
   * 获取缓存统计信息
   */
  getStatistics(): {
    totalEntries: number;
    hitRate: number;
    memoryUsage: MemoryUsage;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.cache.values());
    const memoryUsage = this.getMemoryUsage();

    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    if (entries.length > 0) {
      const dates = entries.map((e) => e.createdAt);
      oldestEntry = new Date(Math.min(...dates.map((d) => d.getTime())));
      newestEntry = new Date(Math.max(...dates.map((d) => d.getTime())));
    }

    return {
      totalEntries: entries.length,
      hitRate: this.getHitRate(),
      memoryUsage,
      oldestEntry,
      newestEntry,
    };
  }

  // ===== 私有方法 =====

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return new Date() > entry.expiresAt;
  }

  /**
   * 计算数据大小
   */
  private calculateSize(value: any): number {
    try {
      const jsonString = JSON.stringify(value);
      return new Blob([jsonString]).size;
    } catch {
      // 如果无法序列化，使用估算值
      return 1024; // 1KB
    }
  }

  /**
   * 确保缓存容量
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    const currentUsage = this.getMemoryUsage();
    const requiredSizeMB = requiredSize / (1024 * 1024);

    if (currentUsage.used + requiredSizeMB <= this.maxSize) {
      return;
    }

    // 需要清理空间
    const targetSize = this.maxSize * 0.8; // 清理到80%
    const sizeToFree = currentUsage.used - targetSize + requiredSizeMB;

    await this.freeMemory(sizeToFree);
  }

  /**
   * 释放内存
   */
  private async freeMemory(sizeToFreeMB: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    let freedSize = 0;

    // 根据策略排序条目
    const sortedEntries = this.sortEntriesByStrategy(entries);

    for (const [key, entry] of sortedEntries) {
      if (freedSize >= sizeToFreeMB * 1024 * 1024) {
        break;
      }

      this.cache.delete(key);
      freedSize += entry.size;
    }

    console.log(`🗑️  释放缓存内存: ${(freedSize / (1024 * 1024)).toFixed(2)} MB`);
  }

  /**
   * 根据策略排序条目
   */
  private sortEntriesByStrategy(entries: [string, CacheEntry][]): [string, CacheEntry][] {
    switch (this.strategy) {
      case 'lru':
        return entries.sort(
          (a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime()
        );
      case 'lfu':
        return entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
      case 'ttl':
        return entries.sort((a, b) => {
          const aExpires = a[1].expiresAt?.getTime() || Infinity;
          const bExpires = b[1].expiresAt?.getTime() || Infinity;
          return aExpires - bExpires;
        });
      case 'adaptive':
        return this.adaptiveSorting(entries);
      default:
        return entries;
    }
  }

  /**
   * 自适应排序
   */
  private adaptiveSorting(entries: [string, CacheEntry][]): [string, CacheEntry][] {
    return entries.sort((a, b) => {
      const aScore = this.calculateAdaptiveScore(a[1]);
      const bScore = this.calculateAdaptiveScore(b[1]);
      return aScore - bScore;
    });
  }

  /**
   * 计算自适应分数
   */
  private calculateAdaptiveScore(entry: CacheEntry): number {
    const now = new Date().getTime();
    const age = now - entry.createdAt.getTime();
    const timeSinceAccess = now - entry.lastAccessedAt.getTime();

    // 综合考虑访问频率、最近访问时间和数据年龄
    const frequencyScore = entry.accessCount;
    const recencyScore = 1 / (timeSinceAccess + 1);
    const ageScore = 1 / (age + 1);

    return frequencyScore * recencyScore * ageScore;
  }

  /**
   * 执行预加载任务
   */
  private async executePreloadTask(task: PreloadTask): Promise<void> {
    const cacheKey = `preload:${task.type}:${task.resourceId}`;

    // 检查是否已缓存
    const existing = await this.get(cacheKey);
    if (existing) {
      return;
    }

    // 模拟数据加载
    const data = await this.loadResourceData(task.type, task.resourceId, task.options);

    // 缓存数据
    await this.set(cacheKey, data, task.options.cacheDuration);

    console.log(`📦 预加载完成: ${task.id}`);
  }

  /**
   * 加载资源数据
   */
  private async loadResourceData(
    type: string,
    resourceId: string,
    options: PreloadOptions
  ): Promise<any> {
    // 这里应该根据类型调用相应的数据加载逻辑
    // 为了简化，返回模拟数据
    return {
      type,
      resourceId,
      loadedAt: new Date(),
      options,
    };
  }

  /**
   * 设置定期清理
   */
  private setupPeriodicCleanup(): void {
    // 每5分钟清理一次过期条目
    setInterval(
      async () => {
        await this.cleanupExpired();
      },
      5 * 60 * 1000
    );
  }

  /**
   * 设置内存监控
   */
  private setupMemoryMonitoring(): void {
    // 每分钟检查内存使用情况
    setInterval(() => {
      const usage = this.getMemoryUsage();
      if (usage.percentage > 90) {
        console.warn(`⚠️  缓存内存使用率过高: ${usage.percentage.toFixed(1)}%`);
      }
    }, 60 * 1000);
  }

  /**
   * 清理过期条目
   */
  private async cleanupExpired(): Promise<void> {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`🗑️  清理过期缓存: ${expiredKeys.length} 个条目`);
    }
  }

  /**
   * 根据策略清理条目
   */
  private async cleanupByStrategy(): Promise<void> {
    const usage = this.getMemoryUsage();

    if (usage.percentage < 80) {
      return; // 内存使用率不高，无需清理
    }

    const targetUsage = this.maxSize * 0.7; // 清理到70%
    const sizeToFree = usage.used - targetUsage;

    await this.freeMemory(sizeToFree);
  }

  /**
   * 优化预加载策略
   */
  private async optimizePreloadStrategy(): Promise<void> {
    // 分析访问模式，优化预加载策略
    // 这里可以实现更复杂的预加载优化逻辑
  }

  /**
   * 获取缓存分类
   */
  private getCacheCategory(key: string): string {
    if (key.startsWith('project:')) return 'project';
    if (key.startsWith('spec:')) return 'spec';
    if (key.startsWith('plan:')) return 'plan';
    if (key.startsWith('execution:')) return 'execution';
    if (key.startsWith('design:')) return 'design';
    if (key.startsWith('preload:')) return 'preload';
    return 'other';
  }

  /**
   * 生成优化建议
   */
  private generateOptimizationRecommendations(before: MemoryUsage, after: MemoryUsage): string[] {
    const recommendations: string[] = [];

    if (before.percentage > 90) {
      recommendations.push('缓存使用率过高，建议增加缓存容量或调整TTL');
    }

    if (this.getHitRate() < 0.5) {
      recommendations.push('缓存命中率较低，建议优化预加载策略');
    }

    const improvement = ((before.used - after.used) / before.used) * 100;
    if (improvement > 20) {
      recommendations.push('缓存优化效果显著，建议定期执行优化');
    }

    return recommendations;
  }
}
