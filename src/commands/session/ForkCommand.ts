import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SessionService } from '../../services/SessionService';
import type { EnhancedMessage } from '../../types/index';

/**
 * ForkCommand - 会话分叉命令
 *
 * 用法：
 * /fork                    交互式选择分叉点
 * /fork <message-uuid>     从指定消息分叉
 */
export class ForkCommand extends SlashCommand {
  name = 'fork';
  description = 'Fork session from a message';
  usage = '/fork [message-uuid]';

  /**
   * 执行命令
   */
  async execute(args: string[], app: Application): Promise<void> {
    const sessionService = app.getContainer().get<SessionService>('session');

    if (!sessionService) {
      await this.output(undefined, '❌ SessionService not available');
      return;
    }

    const currentSession = sessionService.getCurrent();
    if (!currentSession) {
      await this.output(sessionService, '❌ No active session');
      return;
    }

    // 获取所有消息
    const messages = currentSession.messages as EnhancedMessage[];
    if (messages.length === 0) {
      await this.output(sessionService, '❌ No messages to fork from');
      return;
    }

    // 如果提供了 UUID，直接分叉
    if (args.length > 0) {
      const messageUuid = args[0];
      await this.forkFromMessage(sessionService, messageUuid);
      return;
    }

    // 否则，显示交互式选择器
    await this.showForkSelector(sessionService, messages);
  }

  /**
   * 从指定消息分叉
   */
  private async forkFromMessage(
    sessionService: SessionService,
    messageUuid: string
  ): Promise<void> {
    try {
      const newSession = await sessionService.fork({
        fromMessageUuid: messageUuid,
      });

      await this.output(
        sessionService,
        `✅ Session forked: ${newSession.id}\nUse /sessions to switch to it.`
      );
    } catch (error) {
      await this.output(
        sessionService,
        `❌ Fork failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 显示分叉选择器
   */
  private async showForkSelector(
    sessionService: SessionService,
    messages: EnhancedMessage[]
  ): Promise<void> {
    // 过滤出有 uuid 的消息
    const messagesWithUuid = messages.filter((msg) => msg.uuid);

    if (messagesWithUuid.length === 0) {
      await this.output(
        sessionService,
        '❌ No messages with UUID found. Fork requires enhanced messages.\n💡 Tip: New messages will have UUIDs automatically.'
      );
      return;
    }

    // 构建消息列表
    const messageList = messagesWithUuid
      .map((msg, index) => {
        const preview = this.getMessagePreview(msg);
        return `${index + 1}. [${msg.uuid!.slice(0, 8)}] ${msg.role}: ${preview}`;
      })
      .join('\n');

    await this.output(
      sessionService,
      `
📋 Select a message to fork from:

${messageList}

Usage: /fork <message-uuid>

Example: /fork ${messagesWithUuid[0].uuid}
    `.trim()
    );
  }

  private async output(sessionService: SessionService | undefined, message: string): Promise<void> {
    if (sessionService) {
      await sessionService.addMessage({
        role: 'assistant',
        content: message,
      });
      return;
    }

    console.log(message);
  }

  /**
   * 获取消息预览
   */
  private getMessagePreview(message: EnhancedMessage): string {
    const content = message.content;

    if (!content) {
      return '[Empty message]';
    }

    if (typeof content === 'string') {
      return content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    // 处理内容块
    const textBlocks = content.filter((block) => block.type === 'text');
    if (textBlocks.length > 0) {
      const text = (textBlocks[0] as any).text;
      if (text) {
        return text.slice(0, 50) + (text.length > 50 ? '...' : '');
      }
    }

    // 处理工具调用
    const toolBlocks = content.filter((block) => block.type === 'tool_use');
    if (toolBlocks.length > 0) {
      const tool = toolBlocks[0] as any;
      return `[Tool: ${tool.name || 'unknown'}]`;
    }

    return '[Empty message]';
  }
}
