import { nanoid } from 'nanoid';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { ImplementationPlan, Task, Phase } from '../plan/types.js';
import type {
  ExecutionSession,
  CreateExecutionSessionRequest,
  ExecuteTaskRequest,
  TaskExecutionResult,
  TaskDependencyInfo,
  ExecutionProgress,
  ExecutionStatistics,
  ExecutionLog,
} from './types.js';
import { TaskExecutor } from './TaskExecutor.js';
import { ExecutionTracker } from './ExecutionTracker.js';

/**
 * 计划执行器
 *
 * 职责：
 * 1. 管理计划执行会话
 * 2. 分析任务依赖关系
 * 3. 协调任务执行
 * 4. 跟踪执行进度
 */
export class PlanExecutor {
  private taskExecutor: TaskExecutor;
  private executionTracker: ExecutionTracker;
  private activeSessions = new Map<string, ExecutionSession>();

  constructor(
    private eventBus: EventBus,
    private modelService: ModelService
  ) {
    this.taskExecutor = new TaskExecutor(modelService, eventBus);
    this.executionTracker = new ExecutionTracker(eventBus);
  }

  /**
   * 开始执行计划
   */
  async startExecution(
    plan: ImplementationPlan,
    request: CreateExecutionSessionRequest
  ): Promise<ExecutionSession> {
    try {
      // 1. 创建执行会话
      const session = this.createExecutionSession(plan, request);

      // 2. 分析任务依赖关系
      const dependencyInfo = this.analyzeTaskDependencies(plan);

      // 3. 初始化执行统计
      session.statistics = this.initializeStatistics(plan);

      // 4. 保存会话
      this.activeSessions.set(session.id, session);

      // 5. 发送事件
      this.emitEvent('execution_session_started', {
        sessionId: session.id,
        planId: plan.id,
        mode: session.mode,
        totalTasks: session.statistics.totalTasks,
      });

      // 6. 开始跟踪
      await this.executionTracker.startTracking(session, plan);

      return session;
    } catch (error) {
      this.emitEvent('execution_session_failed', {
        planId: plan.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 执行任务
   */
  async executeTask(request: ExecuteTaskRequest): Promise<TaskExecutionResult> {
    try {
      const session = this.activeSessions.get(request.sessionId);
      if (!session) {
        throw new Error(`执行会话不存在: ${request.sessionId}`);
      }

      // 1. 验证任务可执行性
      const plan = await this.getPlanForSession(session);
      const task = this.findTaskById(plan, request.taskId);
      if (!task) {
        throw new Error(`任务不存在: ${request.taskId}`);
      }

      const dependencyInfo = this.analyzeTaskDependencies(plan);
      const taskDep = dependencyInfo.find((d) => d.taskId === request.taskId);
      if (!taskDep?.isExecutable) {
        throw new Error(`任务不可执行: ${taskDep?.blockingReasons.join(', ')}`);
      }

      // 2. 更新会话状态
      session.currentTaskId = request.taskId;
      session.status = 'active';

      // 3. 执行任务
      this.emitEvent('task_execution_started', {
        sessionId: session.id,
        taskId: request.taskId,
        taskName: task.name,
      });

      const result = await this.taskExecutor.execute(task, request.mode, request.options);

      // 4. 更新执行结果
      session.taskResults.set(request.taskId, result);

      // 5. 更新任务状态
      task.status =
        result.status === 'completed'
          ? 'completed'
          : result.status === 'failed'
            ? 'cancelled'
            : 'in_progress';
      task.updatedAt = new Date();

      // 6. 更新统计信息
      this.updateStatistics(session, result);

      // 7. 发送事件
      this.emitEvent('task_execution_completed', {
        sessionId: session.id,
        taskId: request.taskId,
        status: result.status,
        duration: result.duration,
        progress: this.calculateProgress(session, plan),
      });

      return result;
    } catch (error) {
      this.emitEvent('task_execution_failed', {
        sessionId: request.sessionId,
        taskId: request.taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 获取可执行任务
   */
  getExecutableTasks(plan: ImplementationPlan, session: ExecutionSession): Task[] {
    const dependencyInfo = this.analyzeTaskDependencies(plan);
    const executableTasks: Task[] = [];

    for (const phase of plan.phases) {
      for (const task of phase.tasks) {
        // 跳过已完成或失败的任务
        if (task.status === 'completed' || task.status === 'cancelled') {
          continue;
        }

        // 检查依赖关系
        const taskDep = dependencyInfo.find((d) => d.taskId === task.id);
        if (taskDep?.isExecutable) {
          executableTasks.push(task);
        }
      }
    }

    return executableTasks;
  }

  /**
   * 获取执行进度
   */
  getExecutionProgress(sessionId: string): ExecutionProgress | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return this.executionTracker.getProgress(session);
  }

  /**
   * 暂停执行
   */
  async pauseExecution(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`执行会话不存在: ${sessionId}`);
    }

    session.status = 'paused';

    this.emitEvent('execution_session_paused', {
      sessionId,
      currentTaskId: session.currentTaskId,
    });
  }

  /**
   * 恢复执行
   */
  async resumeExecution(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`执行会话不存在: ${sessionId}`);
    }

    session.status = 'active';

    this.emitEvent('execution_session_resumed', {
      sessionId,
      currentTaskId: session.currentTaskId,
    });
  }

  /**
   * 停止执行
   */
  async stopExecution(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`执行会话不存在: ${sessionId}`);
    }

    session.status = 'cancelled';
    session.endTime = new Date();
    session.totalDuration = session.endTime.getTime() - session.startTime.getTime();

    this.emitEvent('execution_session_stopped', {
      sessionId,
      totalDuration: session.totalDuration,
      completedTasks: session.statistics.completedTasks,
    });

    // 停止跟踪
    await this.executionTracker.stopTracking(sessionId);
  }

  // 私有方法实现...

  private createExecutionSession(
    plan: ImplementationPlan,
    request: CreateExecutionSessionRequest
  ): ExecutionSession {
    return {
      id: nanoid(),
      planId: plan.id,
      name: request.name || `${plan.name} - 执行会话`,
      mode: request.mode,
      status: 'active',
      taskResults: new Map(),
      startTime: new Date(),
      statistics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        skippedTasks: 0,
        overallProgress: 0,
        phaseProgress: new Map(),
      },
      logs: [],
    };
  }

  private analyzeTaskDependencies(plan: ImplementationPlan): TaskDependencyInfo[] {
    const dependencyInfo: TaskDependencyInfo[] = [];
    const allTasks = plan.phases.flatMap((phase) => phase.tasks);

    for (const task of allTasks) {
      const dependencies = task.dependencies || [];
      const dependents = allTasks.filter((t) => t.dependencies?.includes(task.id)).map((t) => t.id);

      // 检查依赖任务是否都已完成
      const isExecutable = dependencies.every((depId) => {
        const depTask = allTasks.find((t) => t.id === depId);
        return depTask?.status === 'completed';
      });

      const blockingReasons: string[] = [];
      if (!isExecutable) {
        const incompleteDeps = dependencies.filter((depId) => {
          const depTask = allTasks.find((t) => t.id === depId);
          return depTask?.status !== 'completed';
        });
        blockingReasons.push(`等待依赖任务完成: ${incompleteDeps.join(', ')}`);
      }

      dependencyInfo.push({
        taskId: task.id,
        dependencies,
        dependents,
        isExecutable: isExecutable && task.status !== 'completed',
        blockingReasons,
      });
    }

    return dependencyInfo;
  }

  private initializeStatistics(plan: ImplementationPlan): ExecutionStatistics {
    const totalTasks = plan.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const phaseProgress = new Map<string, number>();

    for (const phase of plan.phases) {
      phaseProgress.set(phase.id, 0);
    }

    return {
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      overallProgress: 0,
      phaseProgress,
    };
  }

  private updateStatistics(session: ExecutionSession, result: TaskExecutionResult): void {
    const stats = session.statistics;

    if (result.status === 'completed') {
      stats.completedTasks++;
    } else if (result.status === 'failed') {
      stats.failedTasks++;
    } else if (result.status === 'skipped') {
      stats.skippedTasks++;
    }

    stats.overallProgress = (stats.completedTasks / stats.totalTasks) * 100;
  }

  private calculateProgress(
    session: ExecutionSession,
    plan: ImplementationPlan
  ): ExecutionProgress {
    const stats = session.statistics;

    // 计算各阶段进度
    const phases = plan.phases.map((phase) => {
      const phaseTasks = phase.tasks;
      const completedTasks = phaseTasks.filter((t) => t.status === 'completed').length;
      const percentage = phaseTasks.length > 0 ? (completedTasks / phaseTasks.length) * 100 : 0;

      let status: 'pending' | 'in_progress' | 'completed' = 'pending';
      if (percentage === 100) {
        status = 'completed';
      } else if (percentage > 0) {
        status = 'in_progress';
      }

      return {
        phaseId: phase.id,
        phaseName: phase.name,
        percentage,
        completedTasks,
        totalTasks: phaseTasks.length,
        status,
      };
    });

    // 当前执行任务
    let currentTask;
    if (session.currentTaskId) {
      const task = plan.phases.flatMap((p) => p.tasks).find((t) => t.id === session.currentTaskId);

      if (task) {
        const result = session.taskResults.get(task.id);
        const progress = result ? (result.successfulSteps / result.steps.length) * 100 : 0;

        currentTask = {
          taskId: task.id,
          taskName: task.name,
          progress,
        };
      }
    }

    return {
      overall: {
        percentage: stats.overallProgress,
        completedTasks: stats.completedTasks,
        totalTasks: stats.totalTasks,
        estimatedRemainingTime: stats.estimatedRemainingTime,
      },
      phases,
      currentTask,
    };
  }

  private async getPlanForSession(session: ExecutionSession): Promise<ImplementationPlan> {
    // 这里应该从 PlanStorage 获取计划
    // 为了简化，暂时抛出错误
    throw new Error('getPlanForSession not implemented');
  }

  private findTaskById(plan: ImplementationPlan, taskId: string): Task | null {
    for (const phase of plan.phases) {
      const task = phase.tasks.find((t) => t.id === taskId);
      if (task) {
        return task;
      }
    }
    return null;
  }

  private emitEvent(eventName: string, data: any): void {
    this.eventBus.emit(eventName, data);
  }
}
