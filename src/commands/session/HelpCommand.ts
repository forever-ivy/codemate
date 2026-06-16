import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SlashCommandManager } from '../../managers/SlashCommandManager';

/**
 * HelpCommand - 显示帮助信息
 *
 * 用法：
 * /help          # 显示所有命令
 * /help model    # 显示 model 命令的帮助
 */
export class HelpCommand extends SlashCommand {
  name = 'help';
  description = 'Show help information';
  aliases = ['h', '?'];

  async execute(args: string[], app: Application): Promise<void> {
    const commandManager = app.getContainer().get<SlashCommandManager>('command');

    // 如果指定了命令名，显示该命令的详细帮助
    if (args.length > 0) {
      const commandName = args[0];
      const command = commandManager.get(commandName);

      if (!command) {
        console.log(`❌ Unknown command: /${commandName}`);
        return;
      }

      console.log(`\n📖 Help for /${command.name}:`);
      console.log(`   ${command.description}`);
      if (command.aliases.length > 0) {
        console.log(`   Aliases: ${command.aliases.map((a) => `/${a}`).join(', ')}`);
      }
      console.log('');
      return;
    }

    // 显示所有命令
    const commands = commandManager.getAllInfo();

    console.log('\n📚 Available Commands:\n');

    // 按类别分组显示
    const categories = {
      'Session Management': ['help', 'clear', 'exit', 'resume', 'sessions', 'fork'],
      'Model Management': ['model', 'models'],
      'System Management': ['status', 'mcp', 'config'],
      'Context Management': ['context', 'add-dir'],
      Development: ['rewind', 'snapshots', 'commit', 'workspace', 'log'],
      'Skills & Agents': ['skill', 'agent'],
    };

    for (const [category, names] of Object.entries(categories)) {
      console.log(`${category}:`);
      for (const name of names) {
        const cmd = commands.find((c) => c.name === name);
        if (cmd) {
          const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
          console.log(`  /${cmd.name}${aliases} - ${cmd.description}`);
        }
      }
      console.log('');
    }

    console.log('💡 Type /help <command> for more information\n');
  }
}
