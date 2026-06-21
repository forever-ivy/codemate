import { SlashCommand } from '../commands/base/SlashCommand';
import type { Application } from '../application/Application';

/**
 * SlashCommandManager - 命令管理器
 *
 * 职责：
 * 1. 注册命令
 * 2. 解析用户输入
 * 3. 路由到对应命令
 * 4. 执行命令
 */
export class SlashCommandManager {
  /**
   * 命令存储
   *
   * key: 命令名称
   * value: 命令实例
   */
  private commands = new Map<string, SlashCommand>();

  /**
   * 别名映射
   *
   * key: 别名
   * value: 命令名称
   */
  private aliases = new Map<string, string>();

  /**
   * 注册命令
   *
   * @param command 命令实例
   * @throws 如果命令名称已存在
   */
  register(command: SlashCommand): void {
    // 检查命令名称是否已存在
    if (this.commands.has(command.name)) {
      throw new Error(`Command already registered: ${command.name}`);
    }

    // 注册命令
    this.commands.set(command.name, command);

    // 注册别名
    for (const alias of command.aliases) {
      if (this.aliases.has(alias)) {
        throw new Error(`Alias already registered: ${alias}`);
      }
      this.aliases.set(alias, command.name);
    }

    console.log(`✅ Registered command: /${command.name}`);
  }

  /**
   * 解析并执行命令
   *
   * @param input 用户输入（包含 /）
   * @param app Application 实例
   * @returns 是否成功执行
   */
  async execute(input: string, app: Application): Promise<boolean> {
    // 1. 检查是否是命令
    if (!input.startsWith('/')) {
      return false; // 不是命令，返回 false
    }

    // 2. 解析命令和参数
    const parts = input.slice(1).trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    // 3. 查找命令（支持别名）
    let command = this.commands.get(commandName);
    if (!command) {
      const realName = this.aliases.get(commandName);
      if (realName) {
        command = this.commands.get(realName);
      }
    }

    // 4. 命令不存在
    if (!command) {
      console.error(`❌ Unknown command: /${commandName}`);
      console.log('💡 Type /help to see available commands');
      return false;
    }

    // 5. 验证参数
    if (!command.validate(args)) {
      console.error(`❌ Invalid arguments for command: /${commandName}`);
      return false;
    }

    // 6. 执行命令
    try {
      console.log(`🔧 Executing command: /${commandName}`);
      await command.execute(args, app);
      console.log(`✅ Command executed successfully: /${commandName}`);
      return true;
    } catch (error) {
      console.error(`❌ Command execution failed: /${commandName}`, error);
      if (error instanceof Error) {
        console.error(`   Error: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * 检查是否是命令
   *
   * @param input 用户输入
   * @returns 是否是命令
   */
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  /**
   * 检查命令是否存在
   *
   * @param name 命令名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.commands.has(name) || this.aliases.has(name);
  }

  /**
   * 获取命令
   *
   * @param name 命令名称
   * @returns 命令实例
   */
  get(name: string): SlashCommand | undefined {
    const command = this.commands.get(name);
    if (command) return command;

    const realName = this.aliases.get(name);
    if (realName) {
      return this.commands.get(realName);
    }

    return undefined;
  }

  /**
   * 列出所有命令
   *
   * @returns 命令名称数组
   */
  list(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * 获取所有命令的信息
   *
   * @returns 命令信息数组
   */
  getAllInfo(): Array<{ name: string; description: string; aliases: string[] }> {
    return Array.from(this.commands.values()).map((cmd) => cmd.getInfo());
  }

  /**
   * 获取命令数量
   *
   * @returns 命令数量
   */
  count(): number {
    return this.commands.size;
  }
}
