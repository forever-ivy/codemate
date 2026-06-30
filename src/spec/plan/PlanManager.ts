import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { SpecManager } from '../SpecManager.js';
import { PlanGenerator } from './PlanGenerator.js';
import { PlanStorage } from './PlanStorage.js';
import type {
  ImplementationPlan,
  CreatePlanRequest,
  UpdatePlanRequest,
  Task,
  Phase,
  TaskStatus,
} from './types.js';

/**
 * 实施计划管理器
 *
 * 职责：
 * 1. 协调计划生成和存储
 * 2. 提供计划管理的统一接口
 * 3. 处理计划相关的业务逻辑
 * 4. 发送计划相关事件
 */
export class PlanManager {
  private planGenerator: PlanGenerator;

  constructor(
    private planStorage: PlanStorage,
    private specManager: SpecManager,
    private eventBus: EventBus,
    private modelService: ModelService
  ) {
    this.planGenerator = new PlanGenerator(modelService);
  }

  /**
   * 初始化计划管理器
   */
  async initialize(): Promise<void> {
    await this.planStorage.initialize();
  }

  /**
   * 创建实施计划
   */
  async create(request: CreatePlanRequest): Promise<ImplementationPlan> {
    try {
      // 1. 获取规格文档
      const spec = await this.specManager.get(request.specId);
      if (!spec) {
        throw new Error(`规格文档不存在: ${request.specId}`);
      }

      // 2. 生成实施计划
      this.emitEvent('plan_generation_started', {
        specId: request.specId,
        options: request.options,
      });

      const plan = await this.planGenerator.generatePlan(
        spec,
        request.options,
        request.projectPath
      );

      // 3. 应用用户自定义信息
      if (request.name) {
        plan.name = request.name;
      }
      if (request.description) {
        plan.description = request.description;
      }

      // 4. 保存计划
      await this.planStorage.save(plan);

      // 5. 发送事件
      this.emitEvent('plan_created', {
        planId: plan.id,
        specId: plan.specId,
        name: plan.name,
        totalEstimate: plan.totalEstimate,
        phasesCount: plan.phases.length,
        tasksCount: this.getTotalTasksCount(plan),
      });

      return plan;
    } catch (error) {
      this.emitEvent('plan_creation_failed', {
        specId: request.specId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取实施计划
   */
  async get(planId: string): Promise<ImplementationPlan | null> {
    try {
      return await this.planStorage.load(planId);
    } catch (error) {
      console.error(`获取计划失败 (${planId}):`, error);
      return null;
    }
  }

  /**
   * 更新实施计划
   */
  async update(request: UpdatePlanRequest): Promise<ImplementationPlan | null> {
    try {
      const updatedPlan = await this.planStorage.update(request.id, request.updates);

      if (updatedPlan) {
        this.emitEvent('plan_updated', {
          planId: updatedPlan.id,
          specId: updatedPlan.specId,
          updates: Object.keys(request.updates),
        });
      }

      return updatedPlan;
    } catch (error) {
      this.emitEvent('plan_update_failed', {
        planId: request.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 删除实施计划
   */
  async delete(planId: string): Promise<boolean> {
    try {
      const plan = await this.get(planId);
      const deleted = await this.planStorage.delete(planId);

      if (deleted && plan) {
        this.emitEvent('plan_deleted', {
          planId,
          specId: plan.specId,
          name: plan.name,
        });
      }

      return deleted;
    } catch (error) {
      this.emitEvent('plan_deletion_failed', {
        planId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 列出所有实施计划
   */
  async list(): Promise<ImplementationPlan[]> {
    try {
      return await this.planStorage.list();
    } catch (error) {
      console.error('列出计划失败:', error);
      return [];
    }
  }

  /**
   * 根据规格ID查找计划
   */
  async findBySpecId(specId: string): Promise<ImplementationPlan[]> {
    try {
      return await this.planStorage.findBySpecId(specId);
    } catch (error) {
      console.error(`根据规格ID查找计划失败 (${specId}):`, error);
      return [];
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    planId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<ImplementationPlan | null> {
    try {
      const plan = await this.get(planId);
      if (!plan) {
        return null;
      }

      // 查找并更新任务
      let taskFound = false;
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          if (task.id === taskId) {
            task.status = status;
            task.updatedAt = new Date();
            taskFound = true;
            break;
          }
        }
        if (taskFound) break;
      }

      if (!taskFound) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      // 保存更新后的计划
      const updatedPlan = await this.planStorage.update(planId, {
        phases: plan.phases,
        updatedAt: new Date(),
      });

      if (updatedPlan) {
        this.emitEvent('task_status_updated', {
          planId,
          taskId,
          status,
          progress: this.calculateProgress(updatedPlan),
        });
      }

      return updatedPlan;
    } catch (error) {
      this.emitEvent('task_update_failed', {
        planId,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取计划进度
   */
  getProgress(plan: ImplementationPlan): {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    percentage: number;
    currentPhase?: Phase;
  } {
    return this.calculateProgress(plan);
  }

  /**
   * 获取计划统计信息
   */
  async getStats(): Promise<{
    totalPlans: number;
    plansBySpec: Record<string, number>;
    recentPlans: ImplementationPlan[];
    taskStats: {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
    };
  }> {
    try {
      const storageStats = await this.planStorage.getStats();
      const allPlans = await this.list();

      let totalTasks = 0;
      let completedTasks = 0;
      let inProgressTasks = 0;
      let pendingTasks = 0;

      for (const plan of allPlans) {
        for (const phase of plan.phases) {
          for (const task of phase.tasks) {
            totalTasks++;
            switch (task.status) {
              case 'completed':
                completedTasks++;
                break;
              case 'in_progress':
                inProgressTasks++;
                break;
              case 'pending':
                pendingTasks++;
                break;
            }
          }
        }
      }

      return {
        ...storageStats,
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          inProgress: inProgressTasks,
          pending: pendingTasks,
        },
      };
    } catch (error) {
      console.error('获取计划统计信息失败:', error);
      return {
        totalPlans: 0,
        plansBySpec: {},
        recentPlans: [],
        taskStats: {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
        },
      };
    }
  }

  /**
   * 导出计划为Markdown
   */
  async exportToMarkdown(planId: string): Promise<string | null> {
    try {
      return await this.planStorage.exportToMarkdown(planId);
    } catch (error) {
      console.error(`导出计划失败 (${planId}):`, error);
      return null;
    }
  }

  /**
   * 复制计划
   */
  async duplicate(planId: string, newName?: string): Promise<ImplementationPlan | null> {
    try {
      const originalPlan = await this.get(planId);
      if (!originalPlan) {
        return null;
      }

      const duplicatedPlan: ImplementationPlan = {
        ...originalPlan,
        id: this.generateId(),
        name: newName || `${originalPlan.name} (副本)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 重置所有任务状态
      for (const phase of duplicatedPlan.phases) {
        for (const task of phase.tasks) {
          task.id = this.generateId();
          task.status = 'pending';
          task.createdAt = new Date();
          task.updatedAt = new Date();
        }
      }

      await this.planStorage.save(duplicatedPlan);

      this.emitEvent('plan_duplicated', {
        originalPlanId: planId,
        newPlanId: duplicatedPlan.id,
        newName: duplicatedPlan.name,
      });

      return duplicatedPlan;
    } catch (error) {
      this.emitEvent('plan_duplication_failed', {
        planId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 验证计划完整性
   */
  async validatePlan(planId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const plan = await this.get(planId);
      if (!plan) {
        return {
          isValid: false,
          errors: ['计划不存在'],
          warnings: [],
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // 检查基本信息
      if (!plan.name.trim()) {
        errors.push('计划名称不能为空');
      }

      if (plan.phases.length === 0) {
        errors.push('计划必须包含至少一个阶段');
      }

      // 检查阶段和任务
      for (const phase of plan.phases) {
        if (!phase.name.trim()) {
          errors.push(`阶段名称不能为空: ${phase.id}`);
        }

        if (phase.tasks.length === 0) {
          warnings.push(`阶段"${phase.name}"没有任务`);
        }

        for (const task of phase.tasks) {
          if (!task.name.trim()) {
            errors.push(`任务名称不能为空: ${task.id}`);
          }

          // 检查依赖关系
          for (const depId of task.dependencies) {
            const depExists = plan.phases.some((p) => p.tasks.some((t) => t.id === depId));
            if (!depExists) {
              errors.push(`任务"${task.name}"依赖的任务不存在: ${depId}`);
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`验证失败: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
      };
    }
  }

  // ===== 私有方法 =====

  /**
   * 计算计划进度
   */
  private calculateProgress(plan: ImplementationPlan): {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    percentage: number;
    currentPhase?: Phase;
  } {
    let totalTasks = 0;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let pendingTasks = 0;
    let currentPhase: Phase | undefined;

    for (const phase of plan.phases) {
      let phaseCompleted = true;
      let phaseStarted = false;

      for (const task of phase.tasks) {
        totalTasks++;

        switch (task.status) {
          case 'completed':
            completedTasks++;
            phaseStarted = true;
            break;
          case 'in_progress':
            inProgressTasks++;
            phaseStarted = true;
            phaseCompleted = false;
            break;
          case 'pending':
            pendingTasks++;
            phaseCompleted = false;
            break;
          case 'blocked':
          case 'cancelled':
            phaseCompleted = false;
            break;
        }
      }

      // 确定当前阶段
      if (!currentPhase && phaseStarted && !phaseCompleted) {
        currentPhase = phase;
      }
    }

    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      percentage,
      currentPhase,
    };
  }

  /**
   * 获取计划总任务数
   */
  private getTotalTasksCount(plan: ImplementationPlan): number {
    return plan.phases.reduce((total, phase) => total + phase.tasks.length, 0);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 发送事件
   */
  private emitEvent(type: string, data: any): void {
    this.eventBus.emit('plan_event', {
      type,
      timestamp: new Date(),
      data,
    });
  }
}
