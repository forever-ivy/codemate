import { Agent } from '../base/Agent';
import type { Task, Result, AgentContext } from '../../types/index';

/**
 * GeneralAgent - 通用型 Agent
 *
 * 职责：
 * 1. 执行通用任务
 * 2. 调用工具完成工作
 * 3. 处理各种类型的请求
 *
 * 使用场景：
 * - 执行具体任务
 * - 文件操作
 * - 代码修改
 */
export class GeneralAgent extends Agent {
  name = 'general-purpose';
  description = '执行通用任务，调用工具完成工作';
  whenToUse = '执行具体任务时使用';

  async execute(task: Task, context: AgentContext): Promise<Result> {
    console.log('⚙️  开始执行任务...');

    try {
      // 1. 解析任务类型
      const taskType = this.parseTaskType(task);

      // 2. 选择工具
      const tool = this.selectTool(taskType);

      // 3. 执行工具
      const result = await this.executeTool(tool, task, context);

      console.log('✅ 任务执行完成');

      return {
        success: true,
        data: result,
        message: '任务已完成',
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
   * 解析任务类型
   */
  private parseTaskType(task: Task): string {
    const goal = task.goal.toLowerCase();

    if (goal.includes('读取') || goal.includes('查看')) return 'read';
    if (goal.includes('写入') || goal.includes('创建')) return 'write';
    if (goal.includes('修改') || goal.includes('编辑')) return 'edit';
    if (goal.includes('删除')) return 'delete';
    if (goal.includes('搜索') || goal.includes('查找')) return 'search';
    if (goal.includes('执行') || goal.includes('运行')) return 'execute';

    return 'unknown';
  }

  /**
   * 选择工具
   */
  private selectTool(taskType: string): string {
    const toolMap: Record<string, string> = {
      read: 'read_file',
      write: 'write_file',
      edit: 'edit_file',
      delete: 'delete_file',
      search: 'grep',
      execute: 'bash',
    };

    return toolMap[taskType] || 'read_file';
  }

  /**
   * 执行工具
   */
  private async executeTool(toolName: string, task: Task, context: AgentContext): Promise<any> {
    // 从任务中提取参数
    const params = this.extractParams(task, toolName);

    // 调用工具
    return await context.toolManager.execute(toolName, params);
  }

  /**
   * 提取参数
   */
  private extractParams(task: Task, toolName: string): any {
    // 如果任务上下文中有参数，优先使用
    if (task.context) {
      return task.context;
    }

    // 根据工具类型提供默认参数
    switch (toolName) {
      case 'read_file':
        return { path: 'package.json' };

      case 'write_file':
        return { path: 'test.txt', content: 'Hello World' };

      case 'edit_file':
        return { path: 'test.txt', content: 'Updated content' };

      case 'delete_file':
        return { path: 'test.txt' };

      case 'grep':
        return { pattern: 'test', path: '.' };

      case 'bash':
        return { command: 'echo "Hello from GeneralAgent"' };

      default:
        return { path: '.' };
    }
  }
}
