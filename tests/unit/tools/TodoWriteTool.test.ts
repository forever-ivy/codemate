import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TodoWriteTool } from '../../../src/tools/task/TodoWriteTool';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('TodoWriteTool', () => {
  let writeTool: TodoWriteTool;
  const todosPath = path.join(process.cwd(), '.aicli', 'todos.json');

  beforeEach(() => {
    writeTool = new TodoWriteTool();
  });

  afterEach(async () => {
    try {
      await fs.rm(path.dirname(todosPath), { recursive: true, force: true });
    } catch {}
  });

  it('should add new todo', async () => {
    const result = await writeTool.execute({
      action: 'add',
      text: 'Test todo',
    });

    expect(result.success).toBe(true);
    expect(result.todos).toHaveLength(1);
    expect(result.todos[0].text).toBe('Test todo');
  });

  it('should update todo status', async () => {
    // 先添加
    const addResult = await writeTool.execute({
      action: 'add',
      text: 'Test todo',
    });

    const todoId = addResult.todos[0].id;

    // 再更新
    const updateResult = await writeTool.execute({
      action: 'update',
      id: todoId,
      status: 'done',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.todos[0].status).toBe('done');
  });

  it('should delete todo', async () => {
    // 先添加
    const addResult = await writeTool.execute({
      action: 'add',
      text: 'Test todo',
    });

    const todoId = addResult.todos[0].id;

    // 再删除
    const deleteResult = await writeTool.execute({
      action: 'delete',
      id: todoId,
    });

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.todos).toHaveLength(0);
  });
});
