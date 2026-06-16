/**
 * Rewind命令 - 对话回退功能
 */
import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { EventBus } from '../../services/EventBus';

export class RewindCommand extends SlashCommand {
  name = 'rewind';
  description = 'Rewind conversation to a previous point';
  aliases = ['rw'];

  async execute(_args: string[], app: Application): Promise<void> {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    // 触发显示回退选择器事件
    eventBus.emit('show_rewind_selector');
  }
}
