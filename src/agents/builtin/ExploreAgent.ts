import { Agent } from '../base/Agent';
import type { Task, Result, AgentContext } from '../../types/index';

/**
 * ExploreAgent - 探索型 Agent
 *
 * 职责：
 * 1. 探索代码库结构
 * 2. 识别关键文件
 * 3. 生成代码库地图
 *
 * 使用场景：
 * - 需要理解代码库时
 * - 查找特定功能的实现
 * - 分析项目结构
 */
export class ExploreAgent extends Agent {
  name = 'explore';
  description = '探索代码库结构，识别关键文件';
  whenToUse = '需要理解代码库结构或查找特定功能时使用';

  async execute(task: Task, context: AgentContext): Promise<Result> {
    console.log('🔍 开始探索代码库...');

    try {
      // 1. 列出项目文件
      const files = await this.listProjectFiles(context);

      // 2. 分析文件结构
      const structure = await this.analyzeStructure(files);

      // 3. 识别关键文件
      const keyFiles = await this.identifyKeyFiles(files, task.goal);

      // 4. 生成摘要
      const summary = this.generateSummary(structure, keyFiles);

      console.log('✅ 探索完成');

      return {
        success: true,
        data: {
          files,
          structure,
          keyFiles,
          summary,
        },
        message: '代码库探索完成',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 列出项目文件
   */
  private async listProjectFiles(context: AgentContext): Promise<string[]> {
    const result = await context.toolManager.execute('list_files', {
      path: '.',
      recursive: true,
    });

    return result.files || [];
  }

  /**
   * 分析文件结构
   */
  private async analyzeStructure(files: string[]): Promise<any> {
    // 按目录分组
    const structure: Record<string, string[]> = {};

    for (const file of files) {
      const dir = file.split('/').slice(0, -1).join('/') || '.';
      if (!structure[dir]) {
        structure[dir] = [];
      }
      structure[dir].push(file);
    }

    return structure;
  }

  /**
   * 识别关键文件
   */
  private async identifyKeyFiles(files: string[], goal: string): Promise<string[]> {
    // 简单实现：根据文件名和目标匹配
    const keywords = goal.toLowerCase().split(' ');
    const keyFiles: string[] = [];

    for (const file of files) {
      const fileName = file.toLowerCase();
      if (keywords.some((keyword) => fileName.includes(keyword))) {
        keyFiles.push(file);
      }
    }

    return keyFiles;
  }

  /**
   * 生成摘要
   */
  private generateSummary(structure: any, keyFiles: string[]): string {
    const dirCount = Object.keys(structure).length;
    const fileCount = Object.values(structure).flat().length;

    return `
项目包含 ${dirCount} 个目录，${fileCount} 个文件。
找到 ${keyFiles.length} 个相关文件。
    `.trim();
  }
}
