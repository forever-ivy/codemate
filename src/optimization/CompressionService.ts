import type {
  CompressionConfig,
  TokenUsage,
  ModelLimit,
  PruneResult,
  CompactionResult,
} from './types';
import { PruningService } from './PruningService';
import { CompactionService } from './CompactionService';
import { countTotalTokens } from '../utils/tokenCounter';

/**
 * 压缩服务（主服务）
 *
 * 职责：
 * 1. 检测 Token 溢出
 * 2. 协调剪枝和压缩
 * 3. 管理压缩配置
 */
export class CompressionService {
  private pruningService: PruningService;
  private compactionService: CompactionService;
  private config: CompressionConfig;

  constructor(compactionService: CompactionService, config?: Partial<CompressionConfig>) {
    this.pruningService = new PruningService();
    this.compactionService = compactionService;
    this.config = this.mergeConfig(config);
  }

  /**
   * 合并配置
   */
  private mergeConfig(config?: Partial<CompressionConfig>): CompressionConfig {
    const DEFAULT_CONFIG: CompressionConfig = {
      compaction: {
        auto: true,
        outputTokenMax: 8192,
        autoContinue: true,
        triggerRatio: 0.7,
      },
      pruning: {
        enabled: true,
        protectThreshold: 10000,
        minimumPrune: 1000,
        protectedTools: ['read_file', 'list_files'],
        protectTurns: 2,
      },
    };

    return {
      compaction: {
        ...DEFAULT_CONFIG.compaction,
        ...config?.compaction,
      },
      pruning: {
        ...DEFAULT_CONFIG.pruning,
        ...config?.pruning,
      },
    };
  }

  /**
   * 检查是否溢出
   */
  isOverflow(tokens: TokenUsage, modelLimit: ModelLimit): boolean {
    if (!this.config.compaction.auto) {
      return false;
    }

    const context = modelLimit.context;
    if (context === 0) {
      return false;
    }

    // 计算当前输入 token（包括缓存读取）
    const currentInputTokens = tokens.input + (tokens.cacheRead || 0);

    // 计算压缩阈值
    const compressionThreshold = context * this.config.compaction.triggerRatio;

    const overflow = currentInputTokens > compressionThreshold;

    console.log(
      `[Compression] currentInputTokens=${currentInputTokens}, ` +
        `context=${context}, triggerRatio=${this.config.compaction.triggerRatio}, ` +
        `threshold=${compressionThreshold}, overflow=${overflow}`
    );

    return overflow;
  }

  /**
   * 执行优化
   */
  async optimize(messages: any[]): Promise<{
    messages: any[];
    pruneResult: PruneResult;
    compactionResult?: CompactionResult;
  }> {
    console.log('[Compression] Starting optimization...');

    // 1. 先尝试剪枝
    const pruneResult = this.pruningService.prune(messages, this.config);

    if (pruneResult.pruned) {
      console.log(
        `[Compression] Pruned ${pruneResult.prunedCount} outputs, ` +
          `saved ~${pruneResult.prunedTokens} tokens`
      );
    }

    // 2. 检查是否仍需压缩
    const tokensAfterPrune = countTotalTokens(messages);
    const needsCompaction = tokensAfterPrune > 50000; // 简化判断

    if (needsCompaction && this.config.compaction.auto) {
      console.log('[Compression] Still need compaction, compressing...');

      const compactionResult = await this.compactionService.compact(messages);

      // 替换历史消息为摘要
      const compactedMessages = [
        {
          role: 'user',
          content: compactionResult.summary,
          type: 'message',
          timestamp: new Date().toISOString(),
          uuid: 'compacted-summary',
          parentUuid: null,
        },
      ];

      return {
        messages: compactedMessages,
        pruneResult,
        compactionResult,
      };
    }

    return {
      messages,
      pruneResult,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): CompressionConfig {
    return this.config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = this.mergeConfig(config);
  }
}
