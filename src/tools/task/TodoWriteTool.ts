import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * TodoWriteTool - 写入待办事项
 *
 * 功能：
 * 1. 添加新的待办事项
 * 2. 更新待办状态
 * 3. 删除待办事项
 *
 * 操作类型：
 * - add: 添加新待办
 * - update: 更新状态
 * - delete: 删除待办
 */
export class TodoWriteTool extends Tool {
  name = 'todo_write';
  description = 'Write todo items';

  schema = z.object({
    action: z.enum(['add', 'update', 'delete']).describe('Action to perform'),
    text: z.string().optional().describe('Todo text (for add)'),
    id: z.string().optional().describe('Todo ID (for update/delete)'),
    status: z.enum(['pending', 'done']).optional().describe('New status (for update)'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, text, id, status } = input;

    console.log(`📝 Todo action: ${action}`);

    try {
      // 1. 获取 todos 文件路径
      const todosPath = this.getTodosPath();

      // 2. 读取现有 todos
      let todos: Array<{ id: string; text: string; status: string; created: string }> = [];

      try {
        const content = await fs.readFile(todosPath, 'utf-8');
        todos = JSON.parse(content);
      } catch {
        // 文件不存在，创建空数组
      }

      // 3. 执行操作
      switch (action) {
        case 'add':
          if (!text) {
            throw new Error('Text is required for add action');
          }
          const newTodo = {
            id: `todo-${Date.now()}`,
            text,
            status: 'pending',
            created: new Date().toISOString(),
          };
          todos.push(newTodo);
          break;

        case 'update':
          if (!id || !status) {
            throw new Error('ID and status are required for update action');
          }
          const todoIndex = todos.findIndex((t) => t.id === id);
          if (todoIndex === -1) {
            throw new Error(`Todo not found: ${id}`);
          }
          todos[todoIndex].status = status;
          break;

        case 'delete':
          if (!id) {
            throw new Error('ID is required for delete action');
          }
          const deleteIndex = todos.findIndex((t) => t.id === id);
          if (deleteIndex === -1) {
            throw new Error(`Todo not found: ${id}`);
          }
          todos.splice(deleteIndex, 1);
          break;
      }

      // 4. 保存 todos
      await fs.mkdir(path.dirname(todosPath), { recursive: true });
      await fs.writeFile(todosPath, JSON.stringify(todos, null, 2), 'utf-8');

      console.log(`✅ Todo ${action} completed`);

      return {
        success: true,
        action,
        todos,
        count: todos.length,
      };
    } catch (error) {
      console.error(`❌ Failed to write todo:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to write todo: ${error.message}`);
      }
      throw new Error('Failed to write todo: Unknown error');
    }
  }

  /**
   * 获取 todos 文件路径
   */
  private getTodosPath(): string {
    return path.join(process.cwd(), '.aicli', 'todos.json');
  }
}
