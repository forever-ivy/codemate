import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SessionService } from '../../services/SessionService';

/**
 * ClearCommand - 清空当前对话，创建新会话
 *
 * 用法：
 * /clear         # 清空当前会话，创建新会话
 */
export class ClearCommand extends SlashCommand {
  name = 'clear';
  description = 'Start a new session';
  aliases = ['c'];

  async execute(_args: string[], app: Application): Promise<void> {
    try {
      const sessionService = app.getContainer().get<SessionService>('session');

      // 直接清除并创建新会话
      const result = await sessionService.clear();

      console.log(`Messages cleared, new session id: ${result.sessionId}`);
    } catch (error) {
      console.log('❌ Failed to clear messages');
      console.error(error);
    }
  }
}
