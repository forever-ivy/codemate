import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { ConfigService } from '../../services/ConfigService';
import type { SessionService } from '../../services/SessionService';

/**
 * ConfigCommand - 配置命令
 *
 * 用法：
 * /config set <key> <value>      设置配置
 * /config get <key>              获取配置
 * /config add <key> <value>      添加配置（数组/对象）
 * /config remove <key> [value]   移除配置
 * /config list                   列出所有配置
 * /config doctor                 检查模型配置
 * /config import-env [provider]  从环境变量导入模型配置
 *
 * 为什么使用 Slash Command？
 * - 与其他命令保持一致
 * - 易于发现和使用
 * - 可以在交互式界面中使用
 */
export class ConfigCommand extends SlashCommand {
  name = 'config';
  description = 'Manage configuration';
  usage = '/config <action> [args...]';

  /**
   * 执行命令
   *
   * @param args 命令参数
   * @param app Application 实例
   */
  async execute(args: string[], app: Application): Promise<void> {
    const configService = app.getContainer().get<ConfigService>('config');
    const sessionService = app.getContainer().get<SessionService>('session');

    if (!configService) {
      await this.outputResult(sessionService, '❌ ConfigService not available');
      return;
    }

    const [action, ...rest] = args;

    let result: string;
    switch (action) {
      case 'set':
        result = this.handleSet(configService, rest);
        break;
      case 'get':
        result = this.handleGet(configService, rest);
        break;
      case 'add':
        result = this.handleAdd(configService, rest);
        break;
      case 'remove':
        result = this.handleRemove(configService, rest);
        break;
      case 'list':
        result = this.handleList(configService);
        break;
      case 'doctor':
        result = this.handleDoctor(configService);
        break;
      case 'import-env':
        result = this.handleImportEnv(configService, rest);
        break;
      default:
        result = this.getHelp();
    }

    await this.outputResult(sessionService, result);
  }

  private async outputResult(
    sessionService: SessionService | undefined,
    result: string
  ): Promise<void> {
    if (sessionService) {
      await sessionService.addMessage({
        role: 'assistant',
        content: result,
      });
      return;
    }

    console.log(result);
  }

  /**
   * 处理 set 命令
   *
   * 使用示例：
   * /config set model claude-sonnet-4
   * /config set agent.Explore.model claude-haiku
   * /config set temperature 0.9
   *
   * 为什么需要解析值？
   * - 命令行参数都是字符串
   * - 需要转换为正确的类型（数字、布尔、对象等）
   */
  private handleSet(configService: ConfigService, args: string[]): string {
    if (args.length < 2) {
      return '❌ Usage: /config set <key> <value>';
    }

    const [key, ...valueParts] = args;
    const value = valueParts.join(' ');

    // 解析值
    let parsedValue: any = value;
    try {
      // 尝试解析为 JSON
      // 这样可以支持：
      // - 数字：0.9
      // - 布尔：true/false
      // - 对象：{"key":"value"}
      // - 数组：["item1","item2"]
      parsedValue = JSON.parse(value);
    } catch {
      // 如果不是 JSON，保持字符串
      // 这样可以支持：
      // - 普通字符串：claude-sonnet-4
      // - 带空格的字符串：my custom prompt
    }

    try {
      // 设置配置（默认设置项目配置）
      configService.setConfig(false, key, parsedValue);
      return `✅ Config set: ${key} = ${JSON.stringify(parsedValue)}`;
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 处理 get 命令
   *
   * 使用示例：
   * /config get model
   * /config get agent.Explore.model
   */
  private handleGet(configService: ConfigService, args: string[]): string {
    if (args.length < 1) {
      return '❌ Usage: /config get <key>';
    }

    const key = args[0];

    try {
      const value = configService.getConfigValue(false, key);

      if (value === undefined) {
        return `❌ Config not found: ${key}`;
      }

      return `${key} = ${JSON.stringify(value, null, 2)}`;
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 处理 add 命令
   *
   * 使用示例：
   * /config add plugins logger-plugin
   * /config add plugins ["plugin1","plugin2"]
   *
   * 为什么需要 add 命令？
   * - 方便添加数组元素
   * - 方便添加对象属性
   * - 不需要先获取再设置
   */
  private handleAdd(configService: ConfigService, args: string[]): string {
    if (args.length < 2) {
      return '❌ Usage: /config add <key> <value>';
    }

    const [key, ...valueParts] = args;
    const value = valueParts.join(' ');

    // 解析值
    let parsedValue: any = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // 保持字符串
    }

    try {
      configService.addConfig(false, key, parsedValue);
      return `✅ Config added: ${key}`;
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 处理 remove 命令
   *
   * 使用示例：
   * /config remove plugins logger-plugin  # 从数组中移除
   * /config remove plugins                # 删除整个键
   */
  private handleRemove(configService: ConfigService, args: string[]): string {
    if (args.length < 1) {
      return '❌ Usage: /config remove <key> [value]';
    }

    const [key, ...values] = args;

    try {
      configService.removeConfig(false, key, values.length > 0 ? values : undefined);
      return `✅ Config removed: ${key}`;
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 处理 list 命令
   *
   * 列出所有配置
   */
  private handleList(configService: ConfigService): string {
    try {
      const config = configService.getEnhancedConfig();
      if (config) {
        return JSON.stringify(config, null, 2);
      }
      // 回退到旧版配置
      return JSON.stringify(configService.getConfig(), null, 2);
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private handleDoctor(configService: ConfigService): string {
    try {
      return configService.formatModelDoctorReport();
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private handleImportEnv(configService: ConfigService, args: string[]): string {
    const provider = args.find((arg) => arg !== 'global' && arg !== 'project');
    const global = args.includes('global');

    try {
      return configService.importDiscoveredProvider(provider, global);
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 获取帮助信息
   */
  private getHelp(): string {
    return `
Config Command Usage:

/config set <key> <value>      Set configuration
/config get <key>              Get configuration
/config add <key> <value>      Add to configuration (array/object)
/config remove <key> [value]   Remove from configuration
/config list                   List all configuration
/config doctor                 Check active model provider and discovered env config
/config import-env [provider] [global|project]
                               Import OPENAI/DEEPSEEK/GLM/etc env config explicitly

Examples:
/config set model claude-sonnet-4
/config set agent.Explore.model claude-haiku
/config set temperature 0.9
/config get model
/config add plugins logger-plugin
/config remove plugins logger-plugin
/config list
/config doctor
/config import-env deepseek
/config import-env glm global

Dot Notation:
You can use dot notation to access nested configuration:
/config set agent.Explore.model claude-haiku
/config get agent.Explore.model
    `.trim();
  }
}
