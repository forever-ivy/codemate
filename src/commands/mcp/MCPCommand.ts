import { SlashCommand } from '../base/SlashCommand';
import type { EventBus } from '../../services/EventBus';
import type { Application } from '../../application/Application';

/**
 * MCP命令
 *
 * 显示MCP服务器管理界面
 */
export class MCPCommand extends SlashCommand {
  name = 'mcp';
  description = 'MCP servers management';
  aliases: string[] = [];

  constructor(private eventBus: EventBus) {
    super();
  }

  async execute(_args: string[], _app: Application): Promise<void> {
    // 触发显示MCP管理器事件
    this.eventBus.emit('show_mcp_manager', {});
  }
}
