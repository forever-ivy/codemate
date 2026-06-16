import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SessionService } from '../../services/SessionService';
import type { ModelService } from '../../services/ModelService';
import { CompactionService } from '../../optimization/CompactionService';

/**
 * CompactCommand - 压缩会话历史以减少token使用
 *
 * 用法：
 * /compact         # 压缩当前会话历史
 *
 * 功能：
 * - 调用AI生成对话摘要
 * - 替换历史消息为摘要
 * - 显示压缩前后的token数量
 */
export class CompactCommand extends SlashCommand {
  name = 'compact';
  description = 'Compress session history to reduce token usage';
  aliases = [];

  async execute(_args: string[], app: Application): Promise<void> {
    try {
      const container = app.getContainer();
      const sessionService = container.get<SessionService>('session');
      const modelService = container.get<ModelService>('model');

      // 获取当前会话消息
      const messages = sessionService.getMessages();

      if (messages.length === 0) {
        console.log('⚠️  No messages to compact');
        return;
      }

      console.log('🔄 Compacting session history...');

      // 创建压缩服务并执行压缩
      const compactionService = new CompactionService(modelService);
      const result = await compactionService.compact(messages);

      // 清空当前消息并添加摘要
      sessionService.clearMessages();
      sessionService.addMessage({
        role: 'user',
        content: `[Previous conversation summary]\n\n${result.summary}`,
      });

      // 显示压缩结果
      console.log('✅ Session history compacted successfully');
      console.log(`📊 Original tokens: ${result.originalTokens}`);
      console.log(`📊 Compacted tokens: ${result.compactedTokens}`);
      const reduction = Math.round((1 - result.compactedTokens / result.originalTokens) * 100);
      console.log(`📉 Reduction: ${reduction}%`);
    } catch (error) {
      console.log('❌ Failed to compact session history');
      console.error(error);
    }
  }
}
