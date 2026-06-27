/**
 * Token 使用统计
 */
export interface TokenUsage {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

/**
 * 模型限制
 */
export interface ModelLimit {
  context: number;
  output: number;
  input?: number;
}

/**
 * 压缩配置
 */
export interface CompressionConfig {
  compaction: {
    auto: boolean;
    outputTokenMax: number;
    autoContinue: boolean;
    triggerRatio: number;
  };
  pruning: {
    enabled: boolean;
    protectThreshold: number;
    minimumPrune: number;
    protectedTools: string[];
    protectTurns: number;
  };
}

/**
 * 剪枝结果
 */
export interface PruneResult {
  pruned: boolean;
  prunedCount: number;
  prunedTokens: number;
}

/**
 * 压缩结果
 */
export interface CompactionResult {
  compacted: boolean;
  originalTokens: number;
  compactedTokens: number;
  summary: string;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  cacheHitRate: number;
  averageResponseTime: number;
  pruneCount: number;
  compactionCount: number;
}
