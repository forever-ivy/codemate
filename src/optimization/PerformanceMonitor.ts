import type { PerformanceMetrics } from './types';

/**
 * 性能监控服务
 *
 * 职责：
 * 1. 统计 Token 使用
 * 2. 追踪缓存命中率
 * 3. 记录响应时间
 * 4. 生成性能报告
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    pruneCount: 0,
    compactionCount: 0,
  };

  private responseTimes: number[] = [];

  /**
   * 记录请求
   */
  recordRequest(data: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    responseTime: number;
  }): void {
    this.metrics.totalRequests++;
    this.metrics.totalInputTokens += data.inputTokens;
    this.metrics.totalOutputTokens += data.outputTokens;
    this.metrics.totalCacheReadTokens += data.cacheReadTokens || 0;
    this.metrics.totalCacheWriteTokens += data.cacheWriteTokens || 0;

    this.responseTimes.push(data.responseTime);

    // 更新缓存命中率
    const totalCacheableTokens =
      this.metrics.totalCacheReadTokens + this.metrics.totalCacheWriteTokens;
    if (totalCacheableTokens > 0) {
      this.metrics.cacheHitRate = this.metrics.totalCacheReadTokens / totalCacheableTokens;
    }

    // 更新平均响应时间
    this.metrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  /**
   * 记录优化
   */
  recordOptimization(data: {
    pruned: boolean;
    prunedTokens?: number;
    compacted: boolean;
    compactedTokens?: number;
  }): void {
    if (data.pruned) {
      this.metrics.pruneCount++;
    }

    if (data.compacted) {
      this.metrics.compactionCount++;
    }
  }

  /**
   * 获取指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 生成报告
   */
  generateReport(): string {
    const m = this.metrics;

    const totalTokens = m.totalInputTokens + m.totalOutputTokens;
    const savedTokens = m.totalCacheReadTokens;
    const savingsRate = totalTokens > 0 ? (savedTokens / totalTokens) * 100 : 0;

    return `
📊 性能报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

请求统计：
  总请求数：${m.totalRequests}
  平均响应时间：${m.averageResponseTime.toFixed(0)}ms

Token 使用：
  输入 Token：${m.totalInputTokens.toLocaleString()}
  输出 Token：${m.totalOutputTokens.toLocaleString()}
  总计：${totalTokens.toLocaleString()}

缓存统计：
  缓存读取：${m.totalCacheReadTokens.toLocaleString()} tokens
  缓存写入：${m.totalCacheWriteTokens.toLocaleString()} tokens
  缓存命中率：${(m.cacheHitRate * 100).toFixed(1)}%
  节省比例：${savingsRate.toFixed(1)}%

优化统计：
  剪枝次数：${m.pruneCount}
  压缩次数：${m.compactionCount}

成本估算（Claude 3.5 Sonnet）：
  输入成本：$${((m.totalInputTokens / 1000000) * 3).toFixed(4)}
  输出成本：$${((m.totalOutputTokens / 1000000) * 15).toFixed(4)}
  总成本：$${((m.totalInputTokens / 1000000) * 3 + (m.totalOutputTokens / 1000000) * 15).toFixed(4)}
  节省成本：$${((savedTokens / 1000000) * 3).toFixed(4)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      pruneCount: 0,
      compactionCount: 0,
    };
    this.responseTimes = [];
  }
}
