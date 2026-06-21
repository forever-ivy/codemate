// src/managers/SkillManager.ts

import { existsSync } from 'node:fs';
import { readdir, readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'pathe';
import matter from 'gray-matter';
import type { Paths } from '../services/Paths';
import type { SlashCommandManager } from './SlashCommandManager';
import { SlashCommand } from '../commands/base/SlashCommand';
import type { Application } from '../application/Application';
import { type AddSkillOptions, type Skill, type SkillFrontmatter, SkillSource } from '../types';

/**
 * SkillManager 类
 *
 * 负责技能的加载、管理和安装
 * 技能是可复用的 AI 提示词模板，支持参数占位符
 */
export class SkillManager {
  // 存储所有技能（name -> Skill）
  private skills: Map<string, Skill> = new Map();

  constructor(
    private paths: Paths,
    private commandManager: SlashCommandManager
  ) {}

  /**
   * 加载所有技能
   *
   * 按优先级从低到高加载，高优先级覆盖低优先级
   * 加载完成后自动注册为 Slash Commands
   */
  async loadSkills(): Promise<void> {
    this.skills.clear();

    // 按优先级顺序加载（低到高）
    const sources: Array<{ source: SkillSource; path: string }> = [
      // Plugin 技能（暂不实现，预留接口）
      // Config 技能（暂不实现，预留接口）

      // GlobalClaude: ~/.claude/skills/
      {
        source: SkillSource.GlobalClaude,
        path: join(homedir(), '.claude', 'skills'),
      },

      // Global: ~/.aicli/skills/
      {
        source: SkillSource.Global,
        path: join(this.paths.globalConfigDir, 'skills'),
      },

      // ProjectClaude: .claude/skills/
      {
        source: SkillSource.ProjectClaude,
        path: join(this.paths.getCwd(), '.claude', 'skills'),
      },

      // Project: .aicli/skills/
      {
        source: SkillSource.Project,
        path: join(this.paths.getCwd(), '.aicli', 'skills'),
      },
    ];

    // 依次加载每个来源的技能
    for (const { source, path } of sources) {
      await this.loadSkillsFromPath(path, source);
    }

    // 注册技能为 Slash Commands
    this.registerCommands();
  }

  /**
   * 从指定路径加载技能
   *
   * @param basePath 技能目录路径
   * @param source 技能来源
   */
  private async loadSkillsFromPath(basePath: string, source: SkillSource): Promise<void> {
    // 检查目录是否存在
    if (!existsSync(basePath)) {
      return;
    }

    try {
      // 读取目录下的所有项
      const entries = await readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 子目录：查找 SKILL.md 文件
          const skillPath = join(basePath, entry.name, 'SKILL.md');
          if (existsSync(skillPath)) {
            await this.loadSkillFile(skillPath, source);
          }
        } else if (entry.name.endsWith('.md')) {
          // Markdown 文件：直接加载
          const skillPath = join(basePath, entry.name);
          await this.loadSkillFile(skillPath, source);
        }
      }
    } catch (error) {
      console.error(`Failed to load skills from ${basePath}:`, error);
    }
  }

  /**
   * 加载单个技能文件
   *
   * @param filePath 技能文件路径
   * @param source 技能来源
   */
  private async loadSkillFile(filePath: string, source: SkillSource): Promise<void> {
    try {
      // 读取文件内容
      const content = await readFile(filePath, 'utf-8');

      // 解析 Frontmatter
      const { data, content: body } = matter(content);
      const frontmatter = data as SkillFrontmatter;

      // 验证必需字段
      if (!frontmatter.name || !frontmatter.description) {
        console.warn(`Invalid skill file ${filePath}: missing name or description`);
        return;
      }

      // 创建技能对象
      const skill: Skill = {
        name: frontmatter.name,
        description: frontmatter.description,
        content: body.trim(),
        source,
        path: filePath,
      };

      // 存储技能（高优先级覆盖低优先级）
      this.skills.set(skill.name, skill);
    } catch (error) {
      console.error(`Failed to load skill file ${filePath}:`, error);
    }
  }

  /**
   * 获取技能
   *
   * @param name 技能名称
   * @returns 技能对象，如果不存在返回 undefined
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有技能
   *
   * @returns 技能数组（按名称排序）
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 从 GitHub 安装技能
   *
   * 使用 degit 库从 GitHub 克隆技能代码
   * 支持格式：user/repo 或 user/repo/path
   *
   * @param source GitHub 地址
   * @param options 安装选项
   */
  async addSkill(source: string, options: AddSkillOptions = {}): Promise<void> {
    // 解析 GitHub 地址
    const { user, repo, path } = this.parseGitHubSource(source);

    // 确定技能名称
    const skillName = options.name || path?.split('/').pop() || repo;

    // 确定安装目录（默认安装到全局）
    const targetDir = join(this.paths.globalConfigDir, 'skills', skillName);

    // 检查是否已存在
    if (existsSync(targetDir) && !options.overwrite) {
      throw new Error(`Skill "${skillName}" already exists. Use --overwrite to replace it.`);
    }

    // 使用 degit 克隆。动态加载避免普通 CLI / headless 启动时触发 degit 的 Node warning。
    const { default: degit } = await import('degit');
    const emitter = degit(`${user}/${repo}${path ? `/${path}` : ''}`, {
      cache: false,
      force: true,
    });

    try {
      await emitter.clone(targetDir);
      console.log(`✓ Skill "${skillName}" installed successfully`);

      // 重新加载技能
      await this.loadSkills();
    } catch (error) {
      throw new Error(`Failed to install skill: ${error}`);
    }
  }

  /**
   * 删除技能
   *
   * 只能删除全局或项目级技能
   *
   * @param name 技能名称
   */
  async removeSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }

    // 只能删除全局或项目级技能
    if (skill.source !== SkillSource.Global && skill.source !== SkillSource.Project) {
      throw new Error(`Cannot remove ${skill.source} skill`);
    }

    // 删除文件或目录
    const targetPath = skill.path.endsWith('SKILL.md')
      ? join(skill.path, '..') // 删除整个目录
      : skill.path; // 删除单个文件

    await rm(targetPath, { recursive: true, force: true });
    console.log(`✓ Skill "${name}" removed successfully`);

    // 重新加载技能
    await this.loadSkills();
  }

  /**
   * 注册技能为 Slash Commands
   *
   * 每个技能自动注册为一个命令
   * 命令执行时会替换参数占位符
   */
  /**
   * 注册技能为 Slash Commands
   *
   * 每个技能自动注册为一个命令
   * 命令执行时会替换参数占位符
   */
  private registerCommands(): void {
    for (const skill of this.skills.values()) {
      // 创建一个动态命令类
      const DynamicSkillCommand = class extends SlashCommand {
        name = skill.name;
        description = skill.description;

        async execute(args: string[], _app: Application): Promise<void> {
          // 替换占位符
          let content = skill.content;

          // 替换位置参数 $1, $2, $3, ...
          for (const [index, arg] of args.entries()) {
            content = content.replace(new RegExp(`\\$${index + 1}`, 'g'), arg);
          }

          // 替换 $ARGUMENTS（所有参数）
          content = content.replace(/\$ARGUMENTS/g, args.join(' '));

          // 将处理后的内容输出（在实际应用中，这里应该将内容添加到会话消息中）
          console.log(`\n📝 Skill "${skill.name}" activated:\n${content}\n`);
        }
      };

      // 注册命令实例
      this.commandManager.register(new DynamicSkillCommand());
    }
  }

  /**
   * 解析 GitHub 地址
   *
   * 支持格式：
   * - user/repo
   * - user/repo/path
   * - user/repo/path/to/skill
   *
   * @param source GitHub 地址
   * @returns 解析结果
   */
  private parseGitHubSource(source: string): {
    user: string;
    repo: string;
    path?: string;
  } {
    const parts = source.split('/');

    if (parts.length < 2) {
      throw new Error('Invalid GitHub source. Format: user/repo or user/repo/path');
    }

    return {
      user: parts[0],
      repo: parts[1],
      path: parts.length > 2 ? parts.slice(2).join('/') : undefined,
    };
  }
}
