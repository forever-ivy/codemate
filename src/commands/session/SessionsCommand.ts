import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SessionService } from '../../services/SessionService';

/**
 * SessionsCommand - 列出所有会话
 *
 * 用法：
 * /sessions      # 列出所有会话
 */
export class SessionsCommand extends SlashCommand {
  name = 'sessions';
  description = 'List all sessions';
  aliases = ['ls'];

  async execute(_args: string[], app: Application): Promise<void> {
    const sessionService = app.getContainer().get<SessionService>('session');

    // 获取所有会话
    const sessions = sessionService.list();

    if (sessions.length === 0) {
      console.log('📭 No sessions found');
      return;
    }

    console.log(`\n📚 Sessions (${sessions.length}):\n`);

    const currentSession = sessionService.getCurrent();

    for (const session of sessions) {
      const isCurrent = currentSession && session.sessionId === currentSession.id;
      const marker = isCurrent ? '👉 ' : '   ';
      console.log(`${marker}${session.sessionId}`);
      console.log(`   Summary: ${session.summary || 'No summary'}`);
      console.log(`   Messages: ${session.messageCount}`);
      console.log(`   Created: ${new Date(session.created).toLocaleString()}`);
      console.log('');
    }
  }
}
