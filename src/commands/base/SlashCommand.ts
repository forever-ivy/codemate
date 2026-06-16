import type { Application } from '../../application/Application';

/**
 * SlashCommand - 命令基类
 *
 * 所有 Slash Commands 都继承这个基类
 *
 * 为什么需要基类？
 * 1. 统一接口：所有命令都有相同的方法
 * 2. 代码复用：通用逻辑放在基类
 * 3. 类型安全：TypeScript 类型检查
 */
export abstract class SlashCommand {
  /**
   * 命令名称（必须实现）
   *
   * 示例：'help', 'clear', 'model'
   */
  abstract name: string;

  /**
   * 命令描述（必须实现）
   *
   * 示例：'显示帮助信息'
   */
  abstract description: string;

  /**
   * 命令别名（可选）
   *
   * 示例：['h'] 表示 /h 也能触发 /help
   */
  aliases: string[] = [];

  /**
   * 执行命令（必须实现）
   *
   * @param args 命令参数
   * @param app Application 实例
   * @returns 执行结果
   */
  abstract execute(args: string[], app: Application): Promise<void>;

  /**
   * 验证参数（可选，子类可以覆盖）
   *
   * @param _args 命令参数
   * @returns 是否有效
   */
  validate(_args: string[]): boolean {
    return true; // 默认总是有效
  }

  /**
   * 获取命令信息
   *
   * @returns 命令信息对象
   */
  getInfo(): { name: string; description: string; aliases: string[] } {
    return {
      name: this.name,
      description: this.description,
      aliases: this.aliases,
    };
  }
}
