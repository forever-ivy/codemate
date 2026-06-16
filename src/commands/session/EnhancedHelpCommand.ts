import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import type { SlashCommandManager } from '../../managers/SlashCommandManager.js';
import type { SessionService } from '../../services/SessionService.js';

/**
 * EnhancedHelpCommand - 简化版帮助命令
 *
 */
export class EnhancedHelpCommand extends SlashCommand {
  name = 'help';
  description = 'Show available slash commands';
  aliases = ['h', '?'];

  async execute(args: string[], app: Application): Promise<void> {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');
    const sessionService = app.getContainer().get<SessionService>('session');

    // 如果指定了命令名，显示该命令的详细帮助
    if (args.length > 0) {
      const commandName = args[0];
      const command = commandManager.get(commandName);

      if (!command) {
        const errorMsg = `❌ Unknown command: /${commandName}`;
        await sessionService.addMessage({
          role: 'assistant',
          content: errorMsg,
        });
        return;
      }

      const helpMsg = `📖 Help for /${command.name}:\n   ${command.description}${
        command.aliases.length > 0
          ? `\n   Aliases: ${command.aliases.map((a) => `/${a}`).join(', ')}`
          : ''
      }`;

      await sessionService.addMessage({
        role: 'assistant',
        content: helpMsg,
      });
      return;
    }

    // 获取所有命令并按类别分组
    const commands = commandManager.getAllInfo();

    if (commands.length === 0) {
      await sessionService.addMessage({
        role: 'assistant',
        content: 'No commands available.',
      });
      return;
    }

    // 按类别分组命令
    const categories = this.categorizeCommands(commands);

    let result = 'Available slash commands:\n\n';

    // 基础命令
    if (categories.basic.length > 0) {
      result += '📦 Basic Commands:\n';
      categories.basic.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 会话管理
    if (categories.session.length > 0) {
      result += '💬 Session Management:\n';
      categories.session.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 模型管理
    if (categories.model.length > 0) {
      result += '🤖 Model Management:\n';
      categories.model.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 系统管理
    if (categories.system.length > 0) {
      result += '📊 System Management:\n';
      categories.system.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 工作空间
    if (categories.workspace.length > 0) {
      result += '📁 Workspace:\n';
      categories.workspace.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 开发工具
    if (categories.development.length > 0) {
      result += '🛠️ Development:\n';
      categories.development.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    // 其他命令
    if (categories.other.length > 0) {
      result += '🔧 Other Commands:\n';
      categories.other.forEach((cmd) => {
        const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
        result += `  /${cmd.name}${aliases} - ${cmd.description}\n`;
      });
      result += '\n';
    }

    result += `Total: ${commands.length} commands available`;

    // 将帮助信息添加到会话消息中
    await sessionService.addMessage({
      role: 'assistant',
      content: result.trim(),
    });
  }

  private categorizeCommands(commands: any[]) {
    const categories = {
      basic: [] as any[],
      session: [] as any[],
      model: [] as any[],
      system: [] as any[],
      workspace: [] as any[],
      development: [] as any[],
      other: [] as any[],
    };

    const basicCommands = ['help', 'clear', 'exit'];
    const sessionCommands = ['sessions', 'resume', 'fork'];
    const modelCommands = ['model', 'models'];
    const systemCommands = ['status', 'mcp', 'config'];
    const workspaceCommands = ['workspace', 'add-dir'];
    const developmentCommands = ['commit', 'log', 'rewind', 'snapshots', 'skill', 'agent'];

    commands.forEach((cmd) => {
      if (basicCommands.includes(cmd.name)) {
        categories.basic.push(cmd);
      } else if (sessionCommands.includes(cmd.name)) {
        categories.session.push(cmd);
      } else if (modelCommands.includes(cmd.name)) {
        categories.model.push(cmd);
      } else if (systemCommands.includes(cmd.name)) {
        categories.system.push(cmd);
      } else if (workspaceCommands.includes(cmd.name)) {
        categories.workspace.push(cmd);
      } else if (developmentCommands.includes(cmd.name)) {
        categories.development.push(cmd);
      } else {
        categories.other.push(cmd);
      }
    });

    return categories;
  }
}
