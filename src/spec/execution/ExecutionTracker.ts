import type { EventBus } from '../../services/EventBus.js';
import type { ImplementationPlan } from '../plan/types.js';
import type {
  ExecutionSession,
  ExecutionProgress,
  ExecutionLog,
  ExecutionStatistics,
} from './types.js';

/**
 * 执行跟踪器
 *
 * 职责：
 * 1. 跟踪执行进度
 * 2. 生成进度报告
 * 3. 处理执行异常
 * 4. 保存执行会话
 */
export class ExecutionTracker {
  private trackingSessions = new Map<
    string,
    {
      session: ExecutionSession;
      plan: ImplementationPlan;
      lastUpdate: Date;
    }
  >();

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  /**
   * 开始跟踪执行会话
   */
  async startTracking(session: ExecutionSession, plan: ImplementationPlan): Promise<void> {
    this.trackingSessions.set(session.id, {
      session,
      plan,
      lastUpdate: new Date(),
    });

    this.log(session, 'info', `开始跟踪执行会话: ${session.name}`);

    // 启动定期更新
    this.scheduleProgressUpdate(session.id);
  }

  /**
   * 停止跟踪执行会话
   */
  async stopTracking(sessionId: string): Promise<void> {
    const tracking = this.trackingSessions.get(sessionId);
    if (!tracking) {
      return;
    }

    this.log(tracking.session, 'info', '停止跟踪执行会话');

    // 保存最终状态
    await this.saveSession(tracking.session);

    // 移除跟踪
    this.trackingSessions.delete(sessionId);
  }

  /**
   * 获取执行进度
   */
  getProgress(session: ExecutionSession): ExecutionProgress {
    const tracking = this.trackingSessions.get(session.id);
    if (!tracking) {
      throw new Error(`执行会话未在跟踪中: ${session.id}`);
    }

    return this.calculateProgress(session, tracking.plan);
  }

  /**
   * 生成进度报告
   */
  generateProgressReport(sessionId: string): {
    summary: string;
    details: ExecutionProgress;
    recommendations: string[];
  } | null {
    const tracking = this.trackingSessions.get(sessionId);
    if (!tracking) {
      return null;
    }

    const progress = this.calculateProgress(tracking.session, tracking.plan);
    const summary = this.generateProgressSummary(progress, tracking.session);
    const recommendations = this.generateRecommendations(progress, tracking.session);

    return {
      summary,
      details: progress,
      recommendations,
    };
  }

  /**
   * 处理执行异常
   */
  handleException(sessionId: string, error: Error, context?: any): void {
    const tracking = this.trackingSessions.get(sessionId);
    if (!tracking) {
      return;
    }

    this.log(tracking.session, 'error', `执行异常: ${error.message}`, context);

    // 发送异常事件
    this.eventBus.emit('execution_exception', {
      sessionId,
      error: error.message,
      context,
      timestamp: new Date(),
    });

    // 尝试恢复或提供建议
    this.suggestRecoveryActions(tracking.session, error);
  }

  /**
   * 保存执行会话
   */
  async saveSession(session: ExecutionSession): Promise<void> {
    try {
      // 这里应该将会话保存到持久化存储
      // 为了简化，我们只是记录日志
      this.log(session, 'info', '保存执行会话状态');

      // 实际实现中，应该保存到文件或数据库
      // await this.sessionStorage.save(session);
    } catch (error) {
      console.error('保存执行会话失败:', error);
    }
  }

  /**
   * 获取执行统计
   */
  getExecutionStatistics(sessionId: string): ExecutionStatistics | null {
    const tracking = this.trackingSessions.get(sessionId);
    if (!tracking) {
      return null;
    }

    return this.updateStatistics(tracking.session, tracking.plan);
  }

  // 私有方法实现

  private setupEventListeners(): void {
    // 监听任务执行事件
    this.eventBus.on('task_execution_started', (data) => {
      this.handleTaskStarted(data);
    });

    this.eventBus.on('task_execution_completed', (data) => {
      this.handleTaskCompleted(data);
    });

    this.eventBus.on('task_execution_failed', (data) => {
      this.handleTaskFailed(data);
    });

    // 监听步骤执行事件
    this.eventBus.on('step_execution_completed', (data) => {
      this.handleStepCompleted(data);
    });
  }

  private handleTaskStarted(data: any): void {
    const tracking = this.trackingSessions.get(data.sessionId);
    if (!tracking) return;

    this.log(tracking.session, 'info', `任务开始执行: ${data.taskName}`, data);
    this.updateLastActivity(data.sessionId);
  }

  private handleTaskCompleted(data: any): void {
    const tracking = this.trackingSessions.get(data.sessionId);
    if (!tracking) return;

    this.log(tracking.session, 'info', `任务执行完成: ${data.taskId}`, data);
    this.updateStatistics(tracking.session, tracking.plan);
    this.updateLastActivity(data.sessionId);
  }

  private handleTaskFailed(data: any): void {
    const tracking = this.trackingSessions.get(data.sessionId);
    if (!tracking) return;

    this.log(tracking.session, 'error', `任务执行失败: ${data.taskId} - ${data.error}`, data);
    this.updateStatistics(tracking.session, tracking.plan);
    this.updateLastActivity(data.sessionId);
  }

  private handleStepCompleted(data: any): void {
    const tracking = this.trackingSessions.get(data.sessionId);
    if (!tracking) return;

    this.updateLastActivity(data.sessionId);
  }

  private calculateProgress(
    session: ExecutionSession,
    plan: ImplementationPlan
  ): ExecutionProgress {
    const allTasks = plan.phases.flatMap((phase) => phase.tasks);
    const completedTasks = allTasks.filter((task) => task.status === 'completed');
    const overallPercentage =
      allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;

    // 计算各阶段进度
    const phases = plan.phases.map((phase) => {
      const phaseTasks = phase.tasks;
      const phaseCompletedTasks = phaseTasks.filter((task) => task.status === 'completed');
      const phasePercentage =
        phaseTasks.length > 0 ? (phaseCompletedTasks.length / phaseTasks.length) * 100 : 0;

      let status: 'pending' | 'in_progress' | 'completed' = 'pending';
      if (phasePercentage === 100) {
        status = 'completed';
      } else if (phasePercentage > 0 || phaseTasks.some((task) => task.status === 'in_progress')) {
        status = 'in_progress';
      }

      return {
        phaseId: phase.id,
        phaseName: phase.name,
        percentage: phasePercentage,
        completedTasks: phaseCompletedTasks.length,
        totalTasks: phaseTasks.length,
        status,
      };
    });

    // 当前执行任务
    let currentTask;
    if (session.currentTaskId) {
      const task = allTasks.find((t) => t.id === session.currentTaskId);
      if (task) {
        const result = session.taskResults.get(task.id);
        const taskProgress =
          result && result.steps.length > 0
            ? (result.successfulSteps / result.steps.length) * 100
            : 0;

        currentTask = {
          taskId: task.id,
          taskName: task.name,
          progress: taskProgress,
        };
      }
    }

    // 估算剩余时间
    const estimatedRemainingTime = this.estimateRemainingTime(session, plan);

    return {
      overall: {
        percentage: overallPercentage,
        completedTasks: completedTasks.length,
        totalTasks: allTasks.length,
        estimatedRemainingTime,
      },
      phases,
      currentTask,
    };
  }

  private updateStatistics(
    session: ExecutionSession,
    plan: ImplementationPlan
  ): ExecutionStatistics {
    const allTasks = plan.phases.flatMap((phase) => phase.tasks);
    const completedTasks = allTasks.filter((task) => task.status === 'completed').length;
    const failedTasks = allTasks.filter((task) => task.status === 'cancelled').length;
    const skippedTasks = 0; // 暂时没有跳过状态
    const overallProgress = allTasks.length > 0 ? (completedTasks / allTasks.length) * 100 : 0;

    // 更新阶段进度
    const phaseProgress = new Map<string, number>();
    for (const phase of plan.phases) {
      const phaseCompletedTasks = phase.tasks.filter((task) => task.status === 'completed').length;
      const phasePercentage =
        phase.tasks.length > 0 ? (phaseCompletedTasks / phase.tasks.length) * 100 : 0;
      phaseProgress.set(phase.id, phasePercentage);
    }

    const statistics: ExecutionStatistics = {
      totalTasks: allTasks.length,
      completedTasks,
      failedTasks,
      skippedTasks,
      overallProgress,
      phaseProgress,
      estimatedRemainingTime: this.estimateRemainingTime(session, plan),
    };

    session.statistics = statistics;
    return statistics;
  }

  private estimateRemainingTime(
    session: ExecutionSession,
    plan: ImplementationPlan
  ): number | undefined {
    const allTasks = plan.phases.flatMap((phase) => phase.tasks);
    const remainingTasks = allTasks.filter(
      (task) => task.status !== 'completed' && task.status !== 'cancelled'
    );

    if (remainingTasks.length === 0) {
      return 0;
    }

    // 简单估算：基于剩余任务的预估时间
    const totalRemainingTime = remainingTasks.reduce((sum, task) => {
      return sum + (task.estimate.expected || 1);
    }, 0);

    // 转换为小时（假设时间单位是天）
    return totalRemainingTime * 8; // 8小时/天
  }

  private generateProgressSummary(progress: ExecutionProgress, session: ExecutionSession): string {
    const { overall } = progress;
    const completionRate = overall.percentage.toFixed(1);
    const remainingTime = overall.estimatedRemainingTime
      ? `，预计剩余 ${Math.ceil(overall.estimatedRemainingTime / 8)} 天`
      : '';

    return `执行进度 ${completionRate}% (${overall.completedTasks}/${overall.totalTasks} 任务完成)${remainingTime}`;
  }

  private generateRecommendations(
    progress: ExecutionProgress,
    session: ExecutionSession
  ): string[] {
    const recommendations: string[] = [];

    // 基于进度生成建议
    if (progress.overall.percentage < 25) {
      recommendations.push('项目刚开始，建议重点关注基础设施和环境搭建');
    } else if (progress.overall.percentage < 75) {
      recommendations.push('项目进展顺利，建议保持当前节奏并关注质量');
    } else {
      recommendations.push('项目接近完成，建议重点关注测试和部署准备');
    }

    // 基于失败任务生成建议
    if (session.statistics.failedTasks > 0) {
      recommendations.push('存在失败任务，建议及时分析原因并制定解决方案');
    }

    // 基于当前任务生成建议
    if (progress.currentTask) {
      recommendations.push(`当前正在执行"${progress.currentTask.taskName}"，建议关注执行进度`);
    }

    return recommendations;
  }

  private suggestRecoveryActions(session: ExecutionSession, error: Error): void {
    // 基于错误类型提供恢复建议
    const suggestions: string[] = [];

    if (error.message.includes('依赖')) {
      suggestions.push('检查任务依赖关系，确保前置任务已完成');
    }

    if (error.message.includes('权限')) {
      suggestions.push('检查执行权限，确保有足够的操作权限');
    }

    if (error.message.includes('网络')) {
      suggestions.push('检查网络连接，确保网络环境正常');
    }

    if (suggestions.length > 0) {
      this.log(session, 'info', `恢复建议: ${suggestions.join('; ')}`);
    }
  }

  private scheduleProgressUpdate(sessionId: string): void {
    // 定期更新进度（每30秒）
    const updateInterval = setInterval(() => {
      const tracking = this.trackingSessions.get(sessionId);
      if (!tracking) {
        clearInterval(updateInterval);
        return;
      }

      // 检查会话是否仍然活跃
      if (tracking.session.status === 'completed' || tracking.session.status === 'cancelled') {
        clearInterval(updateInterval);
        return;
      }

      // 更新统计信息
      this.updateStatistics(tracking.session, tracking.plan);

      // 发送进度更新事件
      this.eventBus.emit('execution_progress_updated', {
        sessionId,
        progress: this.calculateProgress(tracking.session, tracking.plan),
        statistics: tracking.session.statistics,
      });
    }, 30000); // 30秒
  }

  private updateLastActivity(sessionId: string): void {
    const tracking = this.trackingSessions.get(sessionId);
    if (tracking) {
      tracking.lastUpdate = new Date();
    }
  }

  private log(
    session: ExecutionSession,
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: any
  ): void {
    const logEntry: ExecutionLog = {
      id: `${session.id}_${Date.now()}`,
      timestamp: new Date(),
      level,
      message,
      metadata,
    };

    session.logs.push(logEntry);

    // 限制日志数量，避免内存溢出
    if (session.logs.length > 1000) {
      session.logs = session.logs.slice(-500); // 保留最新的500条
    }
  }
}
