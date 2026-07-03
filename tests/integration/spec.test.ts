import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'pathe';
import { tmpdir } from 'node:os';
import { SpecManager } from '../../src/spec/SpecManager.js';
import { EventBus } from '../../src/services/EventBus.js';
import { Paths } from '../../src/services/Paths.js';

describe('Spec System Integration', () => {
  let specManager: SpecManager;
  let eventBus: EventBus;
  let paths: Paths;
  let tempDir: string;

  beforeEach(async () => {
    // 创建唯一的临时目录
    tempDir = join(tmpdir(), `spec-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });

    // 创建服务实例，使用临时目录作为全局配置目录
    eventBus = new EventBus();
    paths = new Paths({ productName: 'aicli', cwd: tempDir });

    // 重写paths的getDataDir方法以使用临时目录
    (paths as any).globalConfigDir = tempDir;

    specManager = new SpecManager(eventBus, paths);

    // 初始化
    await specManager.initialize();
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('文档管理', () => {
    it('应该创建、读取、更新和删除文档', async () => {
      // 创建文档
      const createRequest = {
        title: '集成测试文档',
        description: '这是一个集成测试文档',
        tags: ['test', 'integration'],
      };

      const document = await specManager.create(createRequest);
      expect(document.id).toBeDefined();
      expect(document.title).toBe(createRequest.title);
      expect(document.status).toBe('draft');

      // 读取文档
      const retrieved = await specManager.get(document.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.title).toBe(document.title);

      // 更新文档
      const updateRequest = {
        title: '更新后的标题',
        status: 'review' as const,
      };

      const updated = await specManager.update(document.id, updateRequest);
      expect(updated).toBeDefined();
      expect(updated!.title).toBe(updateRequest.title);
      expect(updated!.status).toBe(updateRequest.status);

      // 删除文档
      const deleted = await specManager.delete(document.id);
      expect(deleted).toBe(true);

      // 确认删除
      const notFound = await specManager.get(document.id);
      expect(notFound).toBeNull();
    });

    it('应该列出文档并支持过滤', async () => {
      // 创建多个文档
      await Promise.all([
        specManager.create({
          title: '文档1',
          description: '第一个文档',
          tags: ['tag1'],
        }),
        specManager.create({
          title: '文档2',
          description: '第二个文档',
          tags: ['tag2'],
        }),
        specManager.create({
          title: '文档3',
          description: '第三个文档',
          tags: ['tag1', 'tag2'],
        }),
      ]);

      // 列出所有文档
      const allDocs = await specManager.list();
      expect(allDocs.total).toBe(3);
      expect(allDocs.items).toHaveLength(3);

      // 按标签过滤
      const filteredByTag = await specManager.list({
        tags: ['tag1'],
      });
      expect(filteredByTag.total).toBe(2);

      // 搜索过滤
      const searchResult = await specManager.list({
        search: '第一',
      });
      expect(searchResult.total).toBe(1);
      expect(searchResult.items[0].title).toBe('文档1');

      // 分页
      const paged = await specManager.list(undefined, undefined, { page: 1, pageSize: 2 });
      expect(paged.items).toHaveLength(2);
      expect(paged.totalPages).toBe(2);
    });
  });

  describe('任务管理', () => {
    let documentId: string;

    beforeEach(async () => {
      const document = await specManager.create({
        title: '任务测试文档',
        description: '用于测试任务功能',
      });
      documentId = document.id;
    });

    it('应该添加、更新和删除任务', async () => {
      // 添加任务
      const taskRequest = {
        title: '测试任务',
        description: '这是一个测试任务',
        priority: 'high' as const,
        estimate: { hours: 2, confidence: 0.8 },
        tags: ['test'],
      };

      const task = await specManager.addTask(documentId, taskRequest);
      expect(task).toBeDefined();
      expect(task!.title).toBe(taskRequest.title);
      expect(task!.priority).toBe(taskRequest.priority);

      // 更新任务
      const updateRequest = {
        status: 'in_progress' as const,
        assignee: 'test-user',
      };

      const updatedTask = await specManager.updateTask(documentId, task!.id, updateRequest);
      expect(updatedTask).toBeDefined();
      expect(updatedTask!.status).toBe(updateRequest.status);
      expect(updatedTask!.assignee).toBe(updateRequest.assignee);

      // 删除任务
      const deleted = await specManager.deleteTask(documentId, task!.id);
      expect(deleted).toBe(true);

      // 确认删除
      const document = await specManager.get(documentId);
      expect(document!.tasks).toHaveLength(0);
    });

    it('应该处理任务依赖关系', async () => {
      // 创建第一个任务
      const task1 = await specManager.addTask(documentId, {
        title: '任务1',
        description: '第一个任务',
      });

      // 创建依赖第一个任务的第二个任务
      const task2 = await specManager.addTask(documentId, {
        title: '任务2',
        description: '依赖任务1',
        dependencies: [task1!.id],
      });

      expect(task2!.dependencies).toContain(task1!.id);

      // 验证文档中的任务
      const document = await specManager.get(documentId);
      expect(document!.tasks).toHaveLength(2);

      const retrievedTask2 = document!.tasks.find((t) => t.id === task2!.id);
      expect(retrievedTask2!.dependencies).toContain(task1!.id);
    });
  });

  describe('事件系统', () => {
    it('应该发送文档相关事件', async () => {
      const events: any[] = [];

      eventBus.on('spec_event', (event) => {
        events.push(event);
      });

      // 创建文档
      const document = await specManager.create({
        title: '事件测试文档',
        description: '测试事件发送',
      });

      // 更新文档
      await specManager.update(document.id, {
        title: '更新后的标题',
      });

      // 删除文档
      await specManager.delete(document.id);

      // 验证事件
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('spec_created');
      expect(events[1].type).toBe('spec_updated');
      expect(events[2].type).toBe('spec_deleted');
    });

    it('应该发送任务相关事件', async () => {
      const events: any[] = [];

      eventBus.on('spec_event', (event) => {
        events.push(event);
      });

      // 创建文档
      const document = await specManager.create({
        title: '任务事件测试',
        description: '测试任务事件',
      });

      // 添加任务
      const task = await specManager.addTask(document.id, {
        title: '测试任务',
        description: '测试任务事件',
      });

      // 完成任务
      await specManager.updateTask(document.id, task!.id, {
        status: 'completed',
      });

      // 删除任务
      await specManager.deleteTask(document.id, task!.id);

      // 验证事件（包括文档创建事件）
      expect(events.length).toBeGreaterThanOrEqual(4);

      const taskEvents = events.filter((e) => e.taskId);
      expect(taskEvents).toHaveLength(3);
      expect(taskEvents[0].type).toBe('task_created');
      expect(taskEvents[1].type).toBe('task_completed');
      expect(taskEvents[2].type).toBe('task_deleted');
    });
  });

  describe('导出功能', () => {
    it('应该导出为不同格式', async () => {
      // 创建带任务的文档
      const document = await specManager.create({
        title: '导出测试文档',
        description: '测试导出功能',
      });

      await specManager.addTask(document.id, {
        title: '测试任务',
        description: '用于测试导出',
      });

      // 导出为JSON
      const jsonExport = await specManager.export(document.id, {
        format: 'json',
        includeTasks: true,
        includeMetadata: true,
        includeHistory: false,
      });

      const jsonData = JSON.parse(jsonExport);
      expect(jsonData.title).toBe('导出测试文档');
      expect(jsonData.tasks).toHaveLength(1);

      // 导出为Markdown
      const markdownExport = await specManager.export(document.id, {
        format: 'markdown',
        includeTasks: true,
        includeMetadata: true,
        includeHistory: false,
      });

      expect(markdownExport).toContain('title: 导出测试文档');
      expect(markdownExport).toContain('tasks:');

      // 导出为HTML
      const htmlExport = await specManager.export(document.id, {
        format: 'html',
        includeTasks: true,
        includeMetadata: true,
        includeHistory: false,
      });

      expect(htmlExport).toContain('<!DOCTYPE html>');
      expect(htmlExport).toContain('导出测试文档');
    });
  });
});
