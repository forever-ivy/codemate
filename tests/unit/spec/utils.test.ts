import { describe, it, expect } from 'vitest';
import {
  calculateTaskProgress,
  calculateTotalEstimate,
  getPriorityWeight,
  sortTasksByPriority,
  getExecutableTasks,
  detectCircularDependencies,
  formatTimeEstimate,
  parseTimeEstimate,
} from '../../../src/spec/utils.js';
import type { SpecTask } from '../../../src/spec/types.js';

describe('Spec Utils', () => {
  const createMockTask = (overrides: Partial<SpecTask> = {}): SpecTask => ({
    id: 'task-1',
    title: '测试任务',
    description: '任务描述',
    status: 'pending',
    priority: 'medium',
    estimate: { hours: 1, confidence: 0.8 },
    dependencies: [],
    assignee: undefined,
    tags: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    completedAt: undefined,
    notes: '',
    ...overrides,
  });

  describe('calculateTaskProgress', () => {
    it('应该计算任务进度', () => {
      const tasks = [
        createMockTask({ status: 'completed' }),
        createMockTask({ id: 'task-2', status: 'in_progress' }),
        createMockTask({ id: 'task-3', status: 'pending' }),
        createMockTask({ id: 'task-4', status: 'blocked' }),
      ];

      const progress = calculateTaskProgress(tasks);

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(1);
      expect(progress.blocked).toBe(1);
      expect(progress.percentage).toBe(25);
    });

    it('应该处理空任务列表', () => {
      const progress = calculateTaskProgress([]);

      expect(progress.total).toBe(0);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('calculateTotalEstimate', () => {
    it('应该计算总时间估算', () => {
      const tasks = [
        createMockTask({ estimate: { hours: 2, confidence: 0.8 } }),
        createMockTask({ id: 'task-2', estimate: { hours: 3, confidence: 0.6 } }),
      ];

      const estimate = calculateTotalEstimate(tasks);

      expect(estimate.hours).toBe(5);
      expect(estimate.confidence).toBe(0.7);
      expect(estimate.notes).toContain('基于 2 个任务的估算');
    });
  });

  describe('getPriorityWeight', () => {
    it('应该返回正确的优先级权重', () => {
      expect(getPriorityWeight('low')).toBe(1);
      expect(getPriorityWeight('medium')).toBe(2);
      expect(getPriorityWeight('high')).toBe(3);
      expect(getPriorityWeight('critical')).toBe(4);
    });
  });

  describe('sortTasksByPriority', () => {
    it('应该按优先级排序任务', () => {
      const tasks = [
        createMockTask({ id: 'task-1', priority: 'low' }),
        createMockTask({ id: 'task-2', priority: 'critical' }),
        createMockTask({ id: 'task-3', priority: 'medium' }),
      ];

      const sorted = sortTasksByPriority(tasks);

      expect(sorted[0].priority).toBe('critical');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
    });
  });

  describe('getExecutableTasks', () => {
    it('应该返回可执行的任务', () => {
      const tasks = [
        createMockTask({ id: 'task-1', status: 'completed' }),
        createMockTask({ id: 'task-2', status: 'pending', dependencies: ['task-1'] }),
        createMockTask({ id: 'task-3', status: 'pending', dependencies: ['task-4'] }),
        createMockTask({ id: 'task-4', status: 'pending' }),
      ];

      const executable = getExecutableTasks(tasks);

      expect(executable).toHaveLength(2);
      expect(executable.map((t) => t.id)).toContain('task-2');
      expect(executable.map((t) => t.id)).toContain('task-4');
    });
  });

  describe('detectCircularDependencies', () => {
    it('应该检测循环依赖', () => {
      const tasks = [
        createMockTask({ id: 'task-1', dependencies: ['task-2'] }),
        createMockTask({ id: 'task-2', dependencies: ['task-3'] }),
        createMockTask({ id: 'task-3', dependencies: ['task-1'] }),
      ];

      const cycles = detectCircularDependencies(tasks);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toContain('task-1');
      expect(cycles[0]).toContain('task-2');
      expect(cycles[0]).toContain('task-3');
    });

    it('应该处理无循环依赖的情况', () => {
      const tasks = [
        createMockTask({ id: 'task-1', dependencies: [] }),
        createMockTask({ id: 'task-2', dependencies: ['task-1'] }),
      ];

      const cycles = detectCircularDependencies(tasks);

      expect(cycles).toHaveLength(0);
    });
  });

  describe('formatTimeEstimate', () => {
    it('应该格式化时间估算', () => {
      expect(formatTimeEstimate({ hours: 0.5, confidence: 0.8 })).toBe('30分钟 (80%)');
      expect(formatTimeEstimate({ hours: 2, confidence: 0.9 })).toBe('2小时 (90%)');
      expect(formatTimeEstimate({ hours: 16, confidence: 0.7 })).toBe('2天 (70%)');
    });
  });

  describe('parseTimeEstimate', () => {
    it('应该解析时间估算字符串', () => {
      expect(parseTimeEstimate('2h')).toEqual({ hours: 2, confidence: 0.7 });
      expect(parseTimeEstimate('30分钟')).toEqual({ hours: 0.5, confidence: 0.8 });
      expect(parseTimeEstimate('1天')).toEqual({ hours: 8, confidence: 0.6 });
      expect(parseTimeEstimate('invalid')).toBeNull();
    });
  });
});
