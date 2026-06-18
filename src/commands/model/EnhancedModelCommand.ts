/**
 * 增强的Model命令 - 触发交互式模型选择器
 */
import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { EventBus } from '../../services/EventBus';

export class EnhancedModelCommand extends SlashCommand {
  name = 'model';
  description = 'Show and select AI model';
  aliases = ['m'];

  async execute(_args: string[], app: Application): Promise<void> {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    // 触发显示模型选择器事件
    eventBus.emit('show_model_selector');
  }
}
