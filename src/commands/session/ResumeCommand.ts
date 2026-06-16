import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { EventBus } from '../../services/EventBus';

/**
 * ResumeCommand - 恢复历史会话
 *
 * 功能：
 * - 显示所有可用的历史会话
 * - 提供交互式选择界面
 * - 恢复选定的会话
 * - 支持键盘导航和分页
 */
export class ResumeCommand extends SlashCommand {
  name = 'resume';
  description = 'Resume from a specific session';

  async execute(_args: string[], app: Application): Promise<void> {
    const eventBus = app.getContainer().get<EventBus>('eventBus');

    // 触发显示resume选择器事件
    eventBus.emit('show_resume_selector');
  }
}
