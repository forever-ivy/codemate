// src/commands/skill/SkillCommand.ts

import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { SkillManager } from '../../managers/SkillManager';
import type { SessionService } from '../../services/SessionService';

/**
 * Skill 命令
 *
 * 管理技能的添加、删除和列表
 * 使用方式：
 * - /skill add <source> [options]
 * - /skill remove <name>
 * - /skill list
 */
export class SkillCommand extends SlashCommand {
  name = 'skill';
  description = 'Manage skills';

  constructor(private skillManager: SkillManager) {
    super();
  }

  /**
   * 执行命令
   *
   * @param args 命令参数
   */
  async execute(args: string[], app: Application): Promise<void> {
    const subcommand = args[0];
    const sessionService = app.getContainer().get<SessionService>('session');

    switch (subcommand) {
      case 'add':
        await this.handleAdd(args.slice(1), sessionService);
        break;

      case 'remove':
      case 'rm':
        await this.handleRemove(args.slice(1), sessionService);
        break;

      case 'list':
      case 'ls':
        await this.handleList(sessionService);
        break;

      default:
        await this.showHelp(sessionService);
    }
  }

  /**
   * 处理 add 子命令
   *
   * 从 GitHub 安装技能
   */
  private async handleAdd(args: string[], sessionService?: SessionService): Promise<void> {
    if (args.length === 0) {
      await this.output(
        sessionService,
        'Error: GitHub source is required\nUsage: /skill add <user/repo> [--name <name>] [--overwrite]'
      );
      return;
    }

    const source = args[0];
    const options: any = {};

    // 解析选项
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--name' && i + 1 < args.length) {
        options.name = args[++i];
      } else if (args[i] === '--overwrite') {
        options.overwrite = true;
      } else if (args[i] === '-i' || args[i] === '--interactive') {
        options.interactive = true;
      }
    }

    try {
      await this.skillManager.addSkill(source, options);
      await this.output(
        sessionService,
        `✅ Skill installed: ${options.name || source.split('/').pop() || source}`
      );
    } catch (error) {
      await this.output(sessionService, `Error: ${error}`);
    }
  }

  /**
   * 处理 remove 子命令
   *
   * 删除已安装的技能
   */
  private async handleRemove(args: string[], sessionService?: SessionService): Promise<void> {
    if (args.length === 0) {
      await this.output(
        sessionService,
        'Error: Skill name is required\nUsage: /skill remove <name>'
      );
      return;
    }

    const name = args[0];

    try {
      await this.skillManager.removeSkill(name);
      await this.output(sessionService, `✅ Skill removed: ${name}`);
    } catch (error) {
      await this.output(sessionService, `Error: ${error}`);
    }
  }

  /**
   * 处理 list 子命令
   *
   * 列出所有可用的技能
   */
  private async handleList(sessionService?: SessionService): Promise<void> {
    const skills = this.skillManager.listSkills();

    if (skills.length === 0) {
      await this.output(sessionService, 'No skills found');
      return;
    }

    const lines = ['Available Skills:', ''];

    for (const skill of skills) {
      lines.push(`  /${skill.name}`);
      lines.push(`    ${skill.description}`);
      lines.push(`    Source: ${skill.source}`);
      lines.push('');
    }

    await this.output(sessionService, lines.join('\n').trimEnd());
  }

  /**
   * 显示帮助信息
   */
  private async showHelp(sessionService?: SessionService): Promise<void> {
    await this.output(
      sessionService,
      `
Usage: /skill <subcommand> [options]

Subcommands:
  add <source>     Install skill from GitHub
  remove <name>    Remove installed skill
  list             List all available skills

Examples:
  /skill add user/repo
  /skill add user/repo/path/to/skill
  /skill add user/repo --name my-skill --overwrite
  /skill remove my-skill
  /skill list
    `.trim()
    );
  }

  private async output(sessionService: SessionService | undefined, message: string): Promise<void> {
    if (sessionService) {
      await sessionService.addMessage({
        role: 'assistant',
        content: message,
      });
      return;
    }

    console.log(message);
  }
}
