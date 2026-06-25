import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * SkillTool - 技能调用工具
 *
 * 功能：
 * 1. 加载预定义的技能
 * 2. 执行技能中的指令
 * 3. 返回技能内容
 *
 * 技能是什么？
 * - 技能是预定义的提示词模板
 * - 存储在 .aicli/skills/ 目录
 * - 可以被 AI 调用
 *
 * 使用场景：
 * - 代码审查
 * - 重构建议
 * - 测试生成
 * - 文档编写
 */
export class SkillTool extends Tool {
  name = 'skill';
  description = 'Load and execute a skill';

  schema = z.object({
    skillName: z.string().describe('Name of the skill to execute'),
    context: z
      .record(z.string(), z.string())
      .optional()
      .describe('Context variables for the skill'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { skillName, context = {} } = input;

    console.log(`🎯 Loading skill: ${skillName}`);

    try {
      // 1. 获取技能文件路径
      const skillPath = this.getSkillPath(skillName);

      // 2. 读取技能内容
      const content = await fs.readFile(skillPath, 'utf-8');

      // 3. 替换上下文变量
      let processedContent = content;
      for (const [key, value] of Object.entries(context)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
      }

      console.log(`✅ Skill loaded: ${skillName}`);

      return {
        success: true,
        skillName,
        content: processedContent,
      };
    } catch (error) {
      console.error(`❌ Failed to load skill:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to load skill: ${error.message}`);
      }
      throw new Error('Failed to load skill: Unknown error');
    }
  }

  /**
   * 获取技能文件路径
   */
  private getSkillPath(skillName: string): string {
    // 技能存储在 .aicli/skills/ 目录
    return path.join(process.cwd(), '.aicli', 'skills', `${skillName}.md`);
  }
}
