import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { EventBus } from '../../services/EventBus';

/**
 * ExitCommand - 退出程序
 *
 * 用法：
 * /exit          # 退出程序
 */
export class ExitCommand extends SlashCommand {
  name = 'exit';
  description = 'Exit the program';
  aliases = ['quit', 'q'];

  async execute(_args: string[], app: Application): Promise<void> {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    if (eventBus.listenerCount('exit_app') > 0) {
      eventBus.emit('exit_app');
      return;
    }

    console.log('👋 Goodbye!');

    await app.stop();

    process.exit(0);
  }
}
