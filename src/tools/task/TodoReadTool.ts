import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * TodoReadTool - 读取待办事项
 *
 * 功能：
 * 1. 读取当前会话的待办事项
 * 2. 支持按状态筛选
 * 3. 返回待办列表
 *
 * 存储位置：~/.aicli/projects/{项目}/todos.json
 */
export class TodoReadTool extends Tool {
  name = 'todo_read';
  description = 'Read todo items';

  schema = z.object({
    status: z.enum(['pending', 'done', 'all']).optional().describe('Filter by status'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { status = 'all' } = input;

    console.log(`📋 Reading todos (status: ${status})`);

    try {
      // 1. 获取 todos 文件路径
      const todosPath = this.getTodosPath();

      // 2. 读取 todos
      let todos: Array<{ id: string; text: string; status: string; created: string }> = [];

      try {
        const content = await fs.readFile(todosPath, 'utf-8');
        todos = JSON.parse(content);
      } catch {
        // 文件不存在，返回空列表
      }

      // 3. 按状态筛选
      const filtered = status === 'all' ? todos : todos.filter((todo) => todo.status === status);

      console.log(`✅ Found ${filtered.length} todos`);

      return {
        success: true,
        todos: filtered,
        count: filtered.length,
      };
    } catch (error) {
      console.error(`❌ Failed to read todos:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to read todos: ${error.message}`);
      }
      throw new Error('Failed to read todos: Unknown error');
    }
  }

  /**
   * 获取 todos 文件路径
   */
  private getTodosPath(): string {
    // 简化实现：存储在当前目录
    // 实际应该存储在 ~/.aicli/projects/{项目}/todos.json
    return path.join(process.cwd(), '.aicli', 'todos.json');
  }
}
