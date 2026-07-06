import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlanStorage } from '../../../src/spec/plan/PlanStorage.js';
import type { ImplementationPlan } from '../../../src/spec/plan/types.js';
import { join } from 'pathe';
import { mkdir, writeFile, readFile, readdir, unlink, rmdir } from 'node:fs/promises';

// Mock Paths service
const mockPaths = {
  getDataDir: vi.fn(() => '/test/data'),
};

describe('PlanStorage', () => {
  let storage: PlanStorage;
  let mockPlan: ImplementationPlan;
  let testDir: string;

  beforeEach(() => {
    storage = new PlanStorage(mockPaths as any);
    testDir = '/test/data/plans';

    mockPlan = {
      id: 'plan-123',
      specId: 'spec-123',
      name: '用户认证系统 - 实施计划',
      description: '详细的实施计划',
      phases: [
        {
          id: 'phase-1',
          name: '项目初始化',
          description: '搭建基础架构',
          tasks: [
            {
              id: 'task-1-1',
              name: '项目结构搭建',
              description: '创建项目目录',
              type: 'setup',
              priority: 'high',
              status: 'pending',
              estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
              dependencies: [],
              prerequisites: [],
              acceptanceCriteria: ['项目结构完整'],
              technicalRequirements: ['Node.js'],
              risks: ['环境问题'],
              tags: ['setup'],
              createdAt: new Date('2024-01-01T10:00:00Z'),
              updatedAt: new Date('2024-01-01T10:00:00Z'),
            },
          ],
          estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
          prerequisites: [],
          objectives: ['建立基础'],
          deliverables: ['项目骨架'],
          milestones: ['环境就绪'],
        },
      ],
      totalEstimate: { min: 10, max: 20, expected: 15, unit: 'days' },
      dependencies: [],
      risks: [
        {
          id: 'risk-1',
          name: '技术风险',
          description: '新技术学习成本',
          category: 'technical',
          impact: 'medium',
          probability: 'medium',
          level: 'medium',
          mitigation: ['技术调研'],
          contingency: ['备选方案'],
        },
      ],
      resources: [
        {
          type: 'developer',
          count: 2,
          skills: ['JavaScript', 'Node.js'],
          allocation: { min: 10, max: 15, expected: 12, unit: 'days' },
        },
      ],
      criticalPath: ['task-1-1'],
      projectPath: '/test/project',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    };

    // Mock file system operations
    vi.mock('node:fs/promises', () => ({
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      readdir: vi.fn(),
      unlink: vi.fn(),
      stat: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该能创建存储目录', async () => {
      const mkdirMock = vi.mocked(mkdir);
      mkdirMock.mockResolvedValue(undefined);

      await storage.initialize();

      expect(mkdirMock).toHaveBeenCalledWith(testDir, { recursive: true });
    });

    it('应该处理目录创建失败', async () => {
      const mkdirMock = vi.mocked(mkdir);
      mkdirMock.mockRejectedValue(new Error('权限不足'));

      await expect(storage.initialize()).rejects.toThrow('权限不足');
    });
  });

  describe('保存计划', () => {
    it('应该能保存实施计划', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const writeFileMock = vi.mocked(writeFile);

      mkdirMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);

      await storage.save(mockPlan);

      expect(mkdirMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledWith(
        join(testDir, 'plan-123.json'),
        expect.stringContaining('"id": "plan-123"'),
        'utf-8'
      );
    });

    it('应该处理保存失败', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const writeFileMock = vi.mocked(writeFile);

      mkdirMock.mockResolvedValue(undefined);
      writeFileMock.mockRejectedValue(new Error('磁盘空间不足'));

      await expect(storage.save(mockPlan)).rejects.toThrow('保存计划失败');
    });
  });

  describe('读取计划', () => {
    it('应该能读取实施计划', async () => {
      const readFileMock = vi.mocked(readFile);
      const planData = JSON.stringify(mockPlan);
      readFileMock.mockResolvedValue(planData);

      const plan = await storage.load('plan-123');

      expect(plan).toBeDefined();
      expect(plan?.id).toBe('plan-123');
      expect(plan?.name).toBe(mockPlan.name);
      expect(plan?.createdAt).toBeInstanceOf(Date);
      expect(plan?.phases[0].tasks[0].createdAt).toBeInstanceOf(Date);
    });

    it('应该在文件不存在时返回null', async () => {
      const readFileMock = vi.mocked(readFile);
      const error = new Error('文件不存在') as any;
      error.code = 'ENOENT';
      readFileMock.mockRejectedValue(error);

      const plan = await storage.load('nonexistent-plan');

      expect(plan).toBeNull();
    });

    it('应该处理JSON解析错误', async () => {
      const readFileMock = vi.mocked(readFile);
      readFileMock.mockResolvedValue('invalid json');

      await expect(storage.load('plan-123')).rejects.toThrow('读取计划失败');
    });
  });

  describe('删除计划', () => {
    it('应该能删除实施计划', async () => {
      const readFileMock = vi.mocked(readFile);
      const unlinkMock = vi.mocked(unlink);

      readFileMock.mockResolvedValue('{}');
      unlinkMock.mockResolvedValue(undefined);

      const result = await storage.delete('plan-123');

      expect(result).toBe(true);
      expect(unlinkMock).toHaveBeenCalledWith(join(testDir, 'plan-123.json'));
    });

    it('应该在文件不存在时返回false', async () => {
      const readFileMock = vi.mocked(readFile);
      const error = new Error('文件不存在') as any;
      error.code = 'ENOENT';
      readFileMock.mockRejectedValue(error);

      const result = await storage.delete('nonexistent-plan');

      expect(result).toBe(false);
    });
  });

  describe('列出计划', () => {
    it('应该能列出所有计划', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const readdirMock = vi.mocked(readdir);
      const readFileMock = vi.mocked(readFile);

      mkdirMock.mockResolvedValue(undefined);
      readdirMock.mockResolvedValue(['plan-123.json', 'plan-456.json', 'other.txt'] as any);
      readFileMock.mockResolvedValue(JSON.stringify(mockPlan));

      const plans = await storage.list();

      expect(plans).toHaveLength(2);
      expect(readdirMock).toHaveBeenCalledWith(testDir);
    });

    it('应该跳过无效的计划文件', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const readdirMock = vi.mocked(readdir);
      const readFileMock = vi.mocked(readFile);

      mkdirMock.mockResolvedValue(undefined);
      readdirMock.mockResolvedValue(['plan-123.json', 'invalid-plan.json'] as any);

      readFileMock
        .mockResolvedValueOnce(JSON.stringify(mockPlan))
        .mockRejectedValueOnce(new Error('无效JSON'));

      const plans = await storage.list();

      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan-123');
    });

    it('应该按创建时间倒序排列', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const readdirMock = vi.mocked(readdir);
      const readFileMock = vi.mocked(readFile);

      const plan1 = { ...mockPlan, id: 'plan-1', createdAt: new Date('2024-01-01') };
      const plan2 = { ...mockPlan, id: 'plan-2', createdAt: new Date('2024-01-02') };

      mkdirMock.mockResolvedValue(undefined);
      readdirMock.mockResolvedValue(['plan-1.json', 'plan-2.json'] as any);
      readFileMock
        .mockResolvedValueOnce(JSON.stringify(plan1))
        .mockResolvedValueOnce(JSON.stringify(plan2));

      const plans = await storage.list();

      expect(plans).toHaveLength(2);
      expect(plans[0].id).toBe('plan-2'); // 更新的在前
      expect(plans[1].id).toBe('plan-1');
    });
  });

  describe('根据规格ID查找', () => {
    it('应该能根据规格ID查找计划', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const readdirMock = vi.mocked(readdir);
      const readFileMock = vi.mocked(readFile);

      const plan1 = { ...mockPlan, id: 'plan-1', specId: 'spec-123' };
      const plan2 = { ...mockPlan, id: 'plan-2', specId: 'spec-456' };

      mkdirMock.mockResolvedValue(undefined);
      readdirMock.mockResolvedValue(['plan-1.json', 'plan-2.json'] as any);
      readFileMock
        .mockResolvedValueOnce(JSON.stringify(plan1))
        .mockResolvedValueOnce(JSON.stringify(plan2));

      const plans = await storage.findBySpecId('spec-123');

      expect(plans).toHaveLength(1);
      expect(plans[0].id).toBe('plan-1');
      expect(plans[0].specId).toBe('spec-123');
    });
  });

  describe('更新计划', () => {
    it('应该能更新实施计划', async () => {
      const readFileMock = vi.mocked(readFile);
      const mkdirMock = vi.mocked(mkdir);
      const writeFileMock = vi.mocked(writeFile);

      readFileMock.mockResolvedValue(JSON.stringify(mockPlan));
      mkdirMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);

      const updates = {
        name: '更新后的计划名称',
        description: '更新后的描述',
      };

      const updatedPlan = await storage.update('plan-123', updates);

      expect(updatedPlan).toBeDefined();
      expect(updatedPlan?.name).toBe(updates.name);
      expect(updatedPlan?.description).toBe(updates.description);
      expect(updatedPlan?.id).toBe('plan-123'); // ID不应该被覆盖
      expect(updatedPlan?.updatedAt).toBeInstanceOf(Date);
    });

    it('应该在计划不存在时返回null', async () => {
      const readFileMock = vi.mocked(readFile);
      const error = new Error('文件不存在') as any;
      error.code = 'ENOENT';
      readFileMock.mockRejectedValue(error);

      const result = await storage.update('nonexistent-plan', { name: '新名称' });

      expect(result).toBeNull();
    });
  });

  describe('检查计划存在', () => {
    it('应该能检查计划是否存在', async () => {
      const { stat } = await import('node:fs/promises');
      const statMock = vi.mocked(stat);
      statMock.mockResolvedValue({} as any);

      const exists = await storage.exists('plan-123');

      expect(exists).toBe(true);
      expect(statMock).toHaveBeenCalledWith(join(testDir, 'plan-123.json'));
    });

    it('应该在文件不存在时返回false', async () => {
      const { stat } = await import('node:fs/promises');
      const statMock = vi.mocked(stat);
      statMock.mockRejectedValue(new Error('文件不存在'));

      const exists = await storage.exists('nonexistent-plan');

      expect(exists).toBe(false);
    });
  });

  describe('统计信息', () => {
    it('应该能获取计划统计信息', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const readdirMock = vi.mocked(readdir);
      const readFileMock = vi.mocked(readFile);

      const plan1 = { ...mockPlan, id: 'plan-1', specId: 'spec-123' };
      const plan2 = { ...mockPlan, id: 'plan-2', specId: 'spec-123' };
      const plan3 = { ...mockPlan, id: 'plan-3', specId: 'spec-456' };

      mkdirMock.mockResolvedValue(undefined);
      readdirMock.mockResolvedValue(['plan-1.json', 'plan-2.json', 'plan-3.json'] as any);
      readFileMock
        .mockResolvedValueOnce(JSON.stringify(plan1))
        .mockResolvedValueOnce(JSON.stringify(plan2))
        .mockResolvedValueOnce(JSON.stringify(plan3));

      const stats = await storage.getStats();

      expect(stats.totalPlans).toBe(3);
      expect(stats.plansBySpec['spec-123']).toBe(2);
      expect(stats.plansBySpec['spec-456']).toBe(1);
      expect(stats.recentPlans).toHaveLength(3);
    });
  });

  describe('导出Markdown', () => {
    it('应该能导出计划为Markdown', async () => {
      const readFileMock = vi.mocked(readFile);
      readFileMock.mockResolvedValue(JSON.stringify(mockPlan));

      const markdown = await storage.exportToMarkdown('plan-123');

      expect(markdown).toBeDefined();
      expect(markdown).toContain('# 用户认证系统 - 实施计划');
      expect(markdown).toContain('## 实施阶段');
      expect(markdown).toContain('### 阶段 1: 项目初始化');
      expect(markdown).toContain('## 风险评估');
      expect(markdown).toContain('## 资源分配');
    });

    it('应该在计划不存在时返回null', async () => {
      const readFileMock = vi.mocked(readFile);
      const error = new Error('文件不存在') as any;
      error.code = 'ENOENT';
      readFileMock.mockRejectedValue(error);

      const markdown = await storage.exportToMarkdown('nonexistent-plan');

      expect(markdown).toBeNull();
    });
  });

  describe('批量导入', () => {
    it('应该能批量导入计划', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const writeFileMock = vi.mocked(writeFile);

      mkdirMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValue(undefined);

      const plans = [
        { ...mockPlan, id: 'plan-1' },
        { ...mockPlan, id: 'plan-2' },
      ];

      const result = await storage.importPlans(plans);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(writeFileMock).toHaveBeenCalledTimes(2);
    });

    it('应该处理部分导入失败', async () => {
      const mkdirMock = vi.mocked(mkdir);
      const writeFileMock = vi.mocked(writeFile);

      mkdirMock.mockResolvedValue(undefined);
      writeFileMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('写入失败'));

      const plans = [
        { ...mockPlan, id: 'plan-1' },
        { ...mockPlan, id: 'plan-2' },
      ];

      const result = await storage.importPlans(plans);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('plan-2');
    });
  });
});
