import type { CompressionConfig, PruneResult } from './types';
import { countTokens } from '../utils/tokenCounter';

/**
 * 剪枝服务
 *
 * 职责：
 * 1. 剪除历史工具输出
 * 2. 保护最近 N 轮对话
 * 3. 保护关键工具
 */
export class PruningService {
  /**
   * 执行剪枝
   */
  prune(messages: any[], config: CompressionConfig): PruneResult {
    if (!config.pruning.enabled) {
      return { pruned: false, prunedCount: 0, prunedTokens: 0 };
    }

    const { protectThreshold, minimumPrune, protectedTools, protectTurns } = config.pruning;

    let totalTokens = 0;
    let prunedTokens = 0;
    const toPrune: any[] = [];
    let turns = 0;

    // 从最新消息向前遍历
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      // 统计对话轮数（用户消息算一轮）
      if (msg.role === 'user') {
        turns++;
      }

      // 检查是否是工具消息
      if (msg.role === 'tool' && Array.isArray(msg.content)) {
        // 保护最近 N 轮
        if (turns < protectTurns) {
          continue;
        }

        for (const part of msg.content) {
          if (part.type !== 'tool-result') continue;

          // 跳过保护的工具
          if (protectedTools.includes(part.toolName)) {
            continue;
          }

          // 跳过已剪枝的部分
          if (part.pruned) {
            break;
          }

          // 估算 token 数量
          const resultContent =
            typeof part.result?.llmContent === 'string'
              ? part.result.llmContent
              : JSON.stringify(part.result?.llmContent || '');
          const tokenEstimate = countTokens(resultContent);
          totalTokens += tokenEstimate;

          // 超过保护阈值的部分标记为剪枝
          if (totalTokens > protectThreshold) {
            prunedTokens += tokenEstimate;
            toPrune.push(part);
          }
        }
      }
    }

    // 只有剪枝量超过最小值才执行
    if (prunedTokens > minimumPrune) {
      for (const part of toPrune) {
        part.pruned = true;
        part.prunedAt = Date.now();
        // 清空原始输出内容，保留元数据
        if (part.result) {
          part.result = {
            ...part.result,
            llmContent: `[Output pruned at ${new Date(part.prunedAt).toISOString()}]`,
          };
        }
      }

      console.log(`[Pruning] Pruned ${toPrune.length} tool outputs, ~${prunedTokens} tokens`);

      return { pruned: true, prunedCount: toPrune.length, prunedTokens };
    }

    return { pruned: false, prunedCount: 0, prunedTokens: 0 };
  }
}
