import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import type { PlanManager } from '../../spec/plan/PlanManager.js';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import { PlanExecutor } from '../../spec/execution/PlanExecutor.js';
import type {
  ExecutionMode,
  ExecutionOptions,
  CreateExecutionSessionRequest,
  ExecuteTaskRequest,
  ExecutionSession,
  ExecutionProgress,
} from '../../spec/execution/types.js';
import type { Task } from '../../spec/plan/types.js';

/**
 * SpecExecutePlanCommand - Spec 计划执行命令
 *
 * 用法：
 * /spec:execute-plan <plan-id>
 * /spec:execute-plan <plan-id> --mode auto
 * /spec:execute-plan <plan-id> --parallel --continue-on-failure
 */
export class SpecExecutePlanCommand extends SlashCommand {
  name = 'spec:execute-plan';
  description = 'Execute implementation plan with task tracking';
  aliases = ['spec:exec', 'execute-plan'];

  private planExecutor?: PlanExecutor;
  private currentSession?: ExecutionSession;

  validate(args: string[]): boolean {
    if (args.length === 0) {
      console.log('❌ 用法: /spec:execute-plan <plan-id> [选项]');
      console.log('   示例: /spec:execute-plan plan_xyz789');
      console.log('   选项:');
      console.log('     --mode <mode>           执行模式 (manual|auto|hybrid)');
      console.log('     --parallel              并行执行独立任务');
      console.log('     --continue-on-failure   失败时继续执行');
      console.log('     --timeout <ms>          执行超时时间');
      console.log('     --verbose               详细日志输出');
      return false;
    }
    return true;
  }

  async execute(args: string[], app: Application): Promise<void> {
    try {
      // 获取服务
      const planManager = app.getContainer().get<PlanManager>('plan');
      const eventBus = app.getContainer().get<EventBus>('eventBus');
      const modelService = app.getContainer().get<ModelService>('model');

      // 初始化执行器
      this.planExecutor = new PlanExecutor(eventBus, modelService);

      // 解析参数
      const { planId, options } = this.parseArguments(args);

      // 获取实施计划
      const plan = await planManager.get(planId);
      if (!plan) {
        console.log(`❌ 实施计划不存在: ${planId}`);
        console.log('💡 使用 /spec:list-plans 查看所有计划');
        return;
      }

      // 设置事件监听器
      this.setupEventListeners(eventBus);

      // 显示计划概览
      this.displayPlanOverview(plan);

      // 创建执行会话
      const sessionRequest: CreateExecutionSessionRequest = {
        planId,
        mode: options.mode,
        options: options.executionOptions,
      };

      this.currentSession = await this.planExecutor.startExecution(plan, sessionRequest);

      console.log(`\n🚀 开始执行会话: ${this.currentSession.name}`);
      console.log(`📊 会话ID: ${this.currentSession.id}`);
      console.log(`⚙️  执行模式: ${this.currentSession.mode}\n`);

      // 开始交互式执行
      await this.startInteractiveExecution(plan);
    } catch (error) {
      console.error('❌ 执行计划失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 解析命令参数
   */
  private parseArguments(args: string[]): {
    planId: string;
    options: {
      mode: ExecutionMode;
      executionOptions: ExecutionOptions;
    };
  } {
    const planId = args[0];
    const options = {
      mode: 'hybrid' as ExecutionMode,
      executionOptions: {
        autoExecuteDependencies: true,
        continueOnFailure: false,
        parallelExecution: false,
        maxParallelTasks: 3,
        executionTimeout: 300000, // 5分钟
        verboseLogging: false,
      } as ExecutionOptions,
    };

    // 解析选项
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--mode':
          if (i + 1 < args.length) {
            const mode = args[i + 1];
            if (['manual', 'auto', 'hybrid'].includes(mode)) {
              options.mode = mode as ExecutionMode;
              i++; // 跳过下一个参数
            }
          }
          break;
        case '--parallel':
          options.executionOptions.parallelExecution = true;
          break;
        case '--continue-on-failure':
          options.executionOptions.continueOnFailure = true;
          break;
        case '--timeout':
          if (i + 1 < args.length) {
            const timeout = parseInt(args[i + 1]);
            if (!isNaN(timeout)) {
              options.executionOptions.executionTimeout = timeout;
              i++; // 跳过下一个参数
            }
          }
          break;
        case '--verbose':
          options.executionOptions.verboseLogging = true;
          break;
      }
    }

    return { planId, options };
  }

  /**
   * 显示计划概览
   */
  private displayPlanOverview(plan: any): void {
    const totalTasks = plan.phases.reduce((sum: number, phase: any) => sum + phase.tasks.length, 0);
    const completedTasks = plan.phases.reduce(
      (sum: number, phase: any) =>
        sum + phase.tasks.filter((task: any) => task.status === 'completed').length,
      0
    );

    console.log(`📋 实施计划: ${plan.name}`);
    console.log(`🆔 计划ID: ${plan.id}`);
    console.log(`📊 总任务数: ${totalTasks}`);
    console.log(`✅ 已完成: ${completedTasks}`);
    console.log(`⏳ 待执行: ${totalTasks - completedTasks}`);
    console.log(`⏱️  预计完成时间: ${plan.totalEstimate.expected} ${plan.totalEstimate.unit}`);
  }

  /**
   * 开始交互式执行
   */
  private async startInteractiveExecution(plan: any): Promise<void> {
    if (!this.planExecutor || !this.currentSession) {
      throw new Error('执行器或会话未初始化');
    }

    let continueExecution = true;

    while (continueExecution) {
      // 显示执行面板
      await this.displayExecutionDashboard(plan);

      // 获取可执行任务
      const executableTasks = this.planExecutor.getExecutableTasks(plan, this.currentSession);

      if (executableTasks.length === 0) {
        console.log('\n🎉 所有任务已完成或无可执行任务！');
        break;
      }

      // 显示可执行任务
      console.log('\n💡 可执行任务:');
      executableTasks.forEach((task, index) => {
        console.log(
          `  ${index + 1}. ${task.name} (${task.estimate.expected} ${task.estimate.unit})`
        );
      });

      // 用户选择
      console.log('\n🎯 选择操作:');
      console.log('  1-N. 执行指定任务');
      console.log('  auto. 自动执行所有可执行任务');
      console.log('  status. 查看详细状态');
      console.log('  pause. 暂停执行');
      console.log('  quit. 退出执行');

      // 简化实现：自动选择第一个任务
      const choice: string = '1';
      console.log(`\n> 选择: ${choice}`);

      if (choice === 'quit') {
        continueExecution = false;
        break;
      } else if (choice === 'auto') {
        await this.executeAllTasks(executableTasks);
      } else if (choice === 'status') {
        await this.displayDetailedStatus();
      } else if (choice === 'pause') {
        await this.pauseExecution();
        break;
      } else {
        const taskIndex = parseInt(choice) - 1;
        if (taskIndex >= 0 && taskIndex < executableTasks.length) {
          await this.executeSelectedTask(executableTasks[taskIndex]);
        }
      }

      // 检查是否所有任务都完成
      const allTasks = plan.phases.flatMap((phase: any) => phase.tasks);
      const remainingTasks = allTasks.filter(
        (task: any) => task.status !== 'completed' && task.status !== 'cancelled'
      );

      if (remainingTasks.length === 0) {
        console.log('\n🎉 所有任务已完成！');
        continueExecution = false;
      }
    }

    // 显示最终统计
    await this.displayFinalSummary();
  }

  /**
   * 显示执行面板
   */
  private async displayExecutionDashboard(plan: any): Promise<void> {
    if (!this.planExecutor || !this.currentSession) return;

    const progress = this.planExecutor.getExecutionProgress(this.currentSession.id);
    if (!progress) return;

    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│                    执行进度面板                              │');
    console.log('├─────────────────────────────────────────────────────────────┤');

    // 显示总体进度
    const overallBar = this.generateProgressBar(progress.overall.percentage);
    console.log(`│ 总体进度: ${overallBar} ${progress.overall.percentage.toFixed(1)}%       │`);
    console.log(
      `│ 已完成: ${progress.overall.completedTasks}/${progress.overall.totalTasks} 任务                                    │`
    );

    if (progress.overall.estimatedRemainingTime) {
      const remainingDays = Math.ceil(progress.overall.estimatedRemainingTime / 8);
      console.log(`│ 预计剩余: ${remainingDays} 天                                        │`);
    }

    console.log('│                                                             │');

    // 显示各阶段进度
    for (const phase of progress.phases) {
      const phaseBar = this.generateProgressBar(phase.percentage);
      const statusIcon = this.getPhaseStatusIcon(phase.status);
      console.log(
        `│ ${statusIcon} ${phase.phaseName.padEnd(20)} ${phaseBar} ${phase.percentage.toFixed(0)}%     │`
      );
    }

    // 显示当前任务
    if (progress.currentTask) {
      console.log('│                                                             │');
      console.log(`│ 🔄 当前任务: ${progress.currentTask.taskName.padEnd(30)}        │`);
      const taskBar = this.generateProgressBar(progress.currentTask.progress);
      console.log(
        `│    进度: ${taskBar} ${progress.currentTask.progress.toFixed(1)}%                    │`
      );
    }

    console.log('└─────────────────────────────────────────────────────────────┘');
  }

  /**
   * 执行选中的任务
   */
  private async executeSelectedTask(task: Task): Promise<void> {
    if (!this.planExecutor || !this.currentSession) return;

    console.log(`\n▶️  开始执行: ${task.name}`);
    console.log(`📋 任务详情:`);
    console.log(`- 描述: ${task.description}`);
    console.log(`- 预计时间: ${task.estimate.expected} ${task.estimate.unit}`);

    if (task.acceptanceCriteria.length > 0) {
      console.log(`- 验收标准:`);
      task.acceptanceCriteria.forEach((criteria) => {
        console.log(`  ✓ ${criteria}`);
      });
    }

    // 询问执行模式
    console.log('\n⚡ 执行选项:');
    console.log('  1. 手动执行 (逐步确认)');
    console.log('  2. 自动执行 (AI 辅助)');
    console.log('  3. 混合执行 (智能选择)');
    console.log('  4. 查看详细步骤');
    console.log('  5. 跳过此任务');

    // 简化实现：选择自动执行
    const choice: string = '2';
    console.log(`\n> 选择: ${choice} (自动执行)`);

    let mode: ExecutionMode = 'auto';
    switch (choice) {
      case '1':
        mode = 'manual';
        break;
      case '2':
        mode = 'auto';
        break;
      case '3':
        mode = 'hybrid';
        break;
      case '4':
        await this.showTaskSteps(task);
        return;
      case '5':
        console.log('⏭️  跳过任务');
        return;
    }

    try {
      const executeRequest: ExecuteTaskRequest = {
        sessionId: this.currentSession.id,
        taskId: task.id,
        mode,
        options: {
          continueOnFailure: false,
          verboseLogging: true,
        },
      };

      console.log('\n🔄 正在执行任务...');
      const result = await this.planExecutor.executeTask(executeRequest);

      // 显示执行结果
      console.log(
        `\n${result.status === 'completed' ? '🎉' : '❌'} 任务执行${result.status === 'completed' ? '完成' : '失败'}！`
      );
      console.log(`⏱️  执行时间: ${Math.round((result.duration || 0) / 1000)}秒`);
      console.log(`✅ 成功步骤: ${result.successfulSteps}`);
      console.log(`❌ 失败步骤: ${result.failedSteps}`);

      if (result.error) {
        console.log(`🔍 错误信息: ${result.error}`);
      }

      // 显示更新后的进度
      const progress = this.planExecutor.getExecutionProgress(this.currentSession.id);
      if (progress) {
        console.log(
          `\n📊 更新后的进度: ${progress.overall.percentage.toFixed(1)}% (${progress.overall.completedTasks}/${progress.overall.totalTasks} 任务完成)`
        );
      }
    } catch (error) {
      console.error(`❌ 任务执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行所有可执行任务
   */
  private async executeAllTasks(tasks: Task[]): Promise<void> {
    console.log(`\n🚀 开始自动执行 ${tasks.length} 个任务...`);

    for (const task of tasks) {
      console.log(`\n▶️  执行任务: ${task.name}`);
      await this.executeSelectedTask(task);
    }

    console.log('\n✅ 自动执行完成！');
  }

  /**
   * 显示详细状态
   */
  private async displayDetailedStatus(): Promise<void> {
    if (!this.planExecutor || !this.currentSession) return;

    const progress = this.planExecutor.getExecutionProgress(this.currentSession.id);
    if (!progress) return;

    console.log('\n📊 详细执行状态:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 显示统计信息
    console.log(`总体进度: ${progress.overall.percentage.toFixed(1)}%`);
    console.log(`已完成任务: ${progress.overall.completedTasks}`);
    console.log(`总任务数: ${progress.overall.totalTasks}`);
    console.log(`剩余任务: ${progress.overall.totalTasks - progress.overall.completedTasks}`);

    if (progress.overall.estimatedRemainingTime) {
      console.log(`预计剩余时间: ${Math.ceil(progress.overall.estimatedRemainingTime / 8)} 天`);
    }

    // 显示各阶段详情
    console.log('\n阶段详情:');
    for (const phase of progress.phases) {
      console.log(
        `  ${this.getPhaseStatusIcon(phase.status)} ${phase.phaseName}: ${phase.percentage.toFixed(1)}% (${phase.completedTasks}/${phase.totalTasks})`
      );
    }

    // 显示当前任务
    if (progress.currentTask) {
      console.log(`\n当前任务: ${progress.currentTask.taskName}`);
      console.log(`任务进度: ${progress.currentTask.progress.toFixed(1)}%`);
    }

    // 显示执行日志（最近10条）
    console.log('\n最近日志:');
    const recentLogs = this.currentSession.logs.slice(-10);
    for (const log of recentLogs) {
      const timeStr = log.timestamp.toLocaleTimeString();
      console.log(`  [${timeStr}] ${log.level.toUpperCase()}: ${log.message}`);
    }
  }

  /**
   * 暂停执行
   */
  private async pauseExecution(): Promise<void> {
    if (!this.planExecutor || !this.currentSession) return;

    await this.planExecutor.pauseExecution(this.currentSession.id);
    console.log('\n⏸️  执行已暂停');
    console.log('💡 使用 /spec:resume-execution 恢复执行');
  }

  /**
   * 显示最终摘要
   */
  private async displayFinalSummary(): Promise<void> {
    if (!this.currentSession) return;

    console.log('\n📋 执行摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`会话名称: ${this.currentSession.name}`);
    console.log(`执行模式: ${this.currentSession.mode}`);
    console.log(`开始时间: ${this.currentSession.startTime.toLocaleString()}`);

    if (this.currentSession.endTime) {
      console.log(`结束时间: ${this.currentSession.endTime.toLocaleString()}`);
      console.log(
        `总耗时: ${Math.round((this.currentSession.totalDuration || 0) / 1000 / 60)} 分钟`
      );
    }

    console.log(`完成任务: ${this.currentSession.statistics.completedTasks}`);
    console.log(`失败任务: ${this.currentSession.statistics.failedTasks}`);
    console.log(`总进度: ${this.currentSession.statistics.overallProgress.toFixed(1)}%`);

    console.log('\n💡 后续操作:');
    console.log('   /spec:show-plan <plan-id>     # 查看计划详情');
    console.log('   /spec:list-sessions           # 查看执行会话');
    console.log('   /spec:execution-report        # 生成执行报告');
  }

  // 辅助方法

  private setupEventListeners(eventBus: EventBus): void {
    eventBus.on('task_execution_started', (data) => {
      if (this.currentSession && data.sessionId === this.currentSession.id) {
        console.log(`🔄 开始执行任务: ${data.taskName}`);
      }
    });

    eventBus.on('task_execution_completed', (data) => {
      if (this.currentSession && data.sessionId === this.currentSession.id) {
        console.log(`✅ 任务完成: ${data.taskId}`);
      }
    });

    eventBus.on('step_execution_completed', (data) => {
      if (this.currentSession && data.sessionId === this.currentSession.id) {
        console.log(`  ✓ 步骤完成: ${data.stepId}`);
      }
    });
  }

  private generateProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '[' + '●'.repeat(filled) + '○'.repeat(empty) + ']';
  }

  private getPhaseStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'pending':
        return '⏳';
      default:
        return '❓';
    }
  }

  private async showTaskSteps(task: Task): Promise<void> {
    console.log(`\n📋 任务步骤: ${task.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 这里应该显示任务的详细步骤
    // 为了简化，显示基本信息
    console.log(`描述: ${task.description}`);
    console.log(`类型: ${task.type}`);
    console.log(`优先级: ${task.priority}`);
    console.log(`预计时间: ${task.estimate.expected} ${task.estimate.unit}`);

    if (task.dependencies.length > 0) {
      console.log(`依赖任务: ${task.dependencies.join(', ')}`);
    }

    if (task.acceptanceCriteria.length > 0) {
      console.log('验收标准:');
      task.acceptanceCriteria.forEach((criteria, index) => {
        console.log(`  ${index + 1}. ${criteria}`);
      });
    }
  }
}
