import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * TaskTool - 任务管理工具
 *
 * 功能：
 * 1. 创建任务
 * 2. 列出任务
 * 3. 更新任务状态
 * 4. 删除任务
 *
 * 与 Todo 的区别：
 * - Todo: 简单的待办事项
 * - Task: 复杂的任务，包含描述、优先级、标签等
 */
export class TaskTool extends Tool {
  name = 'task';
  description = 'Manage tasks';

  schema = z.object({
    action: z.enum(['create', 'list', 'update', 'delete']).describe('Action to perform'),
    title: z.string().optional().describe('Task title (for create)'),
    description: z.string().optional().describe('Task description (for create)'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
    tags: z.array(z.string()).optional().describe('Task tags'),
    id: z.string().optional().describe('Task ID (for update/delete)'),
    status: z.enum(['todo', 'in_progress', 'done']).optional().describe('Task status'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { action, title, description, priority, tags, id, status } = input;

    console.log(`📋 Task action: ${action}`);

    try {
      // 1. 获取 tasks 文件路径
      const tasksPath = this.getTasksPath();

      // 2. 读取现有 tasks
      let tasks: Array<{
        id: string;
        title: string;
        description?: string;
        priority: string;
        status: string;
        tags: string[];
        created: string;
        updated: string;
      }> = [];

      try {
        const content = await fs.readFile(tasksPath, 'utf-8');
        tasks = JSON.parse(content);
      } catch {
        // 文件不存在，创建空数组
      }

      // 3. 执行操作
      let result: any;

      switch (action) {
        case 'create':
          if (!title) {
            throw new Error('Title is required for create action');
          }
          const newTask = {
            id: `task-${Date.now()}`,
            title,
            description,
            priority: priority || 'medium',
            status: 'todo',
            tags: tags || [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
          };
          tasks.push(newTask);
          result = newTask;
          break;

        case 'list':
          result = tasks;
          break;

        case 'update':
          if (!id) {
            throw new Error('ID is required for update action');
          }
          const taskIndex = tasks.findIndex((t) => t.id === id);
          if (taskIndex === -1) {
            throw new Error(`Task not found: ${id}`);
          }
          if (status) tasks[taskIndex].status = status;
          if (priority) tasks[taskIndex].priority = priority;
          if (tags) tasks[taskIndex].tags = tags;
          tasks[taskIndex].updated = new Date().toISOString();
          result = tasks[taskIndex];
          break;

        case 'delete':
          if (!id) {
            throw new Error('ID is required for delete action');
          }
          const deleteIndex = tasks.findIndex((t) => t.id === id);
          if (deleteIndex === -1) {
            throw new Error(`Task not found: ${id}`);
          }
          const deletedTask = tasks[deleteIndex];
          tasks.splice(deleteIndex, 1);
          result = deletedTask;
          break;
      }

      // 4. 保存 tasks（除了 list 操作）
      if (action !== 'list') {
        await fs.mkdir(path.dirname(tasksPath), { recursive: true });
        await fs.writeFile(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8');
      }

      console.log(`✅ Task ${action} completed`);

      return {
        success: true,
        action,
        result,
        count: tasks.length,
      };
    } catch (error) {
      console.error(`❌ Failed to manage task:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to manage task: ${error.message}`);
      }
      throw new Error('Failed to manage task: Unknown error');
    }
  }

  /**
   * 获取 tasks 文件路径
   */
  private getTasksPath(): string {
    return path.join(process.cwd(), '.aicli', 'tasks.json');
  }
}
