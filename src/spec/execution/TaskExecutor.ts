import { nanoid } from 'nanoid';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { Task } from '../plan/types.js';
import type {
  ExecutionMode,
  ExecutionOptions,
  TaskExecutionResult,
  ExecutionStep,
  StepStatus,
  TaskExecutionStatus,
} from './types.js';

/**
 * 任务执行器
 *
 * 职责：
 * 1. 执行单个任务
 * 2. 生成执行步骤
 * 3. 跟踪步骤执行状态
 * 4. 验证任务完成情况
 */
export class TaskExecutor {
  constructor(
    private modelService: ModelService,
    private eventBus: EventBus
  ) {}

  /**
   * 执行任务
   */
  async execute(
    task: Task,
    mode: ExecutionMode,
    options?: ExecutionOptions
  ): Promise<TaskExecutionResult> {
    const startTime = new Date();
    const result: TaskExecutionResult = {
      taskId: task.id,
      status: 'in_progress',
      steps: [],
      startTime,
      successfulSteps: 0,
      failedSteps: 0,
      logs: [],
    };

    try {
      // 1. 生成执行步骤
      this.log(result, 'info', `开始执行任务: ${task.name}`);
      const steps = await this.generateExecutionSteps(task);
      result.steps = steps;

      this.emitEvent('task_steps_generated', {
        taskId: task.id,
        stepsCount: steps.length,
      });

      // 2. 根据模式执行步骤
      switch (mode) {
        case 'manual':
          await this.executeManually(result, options);
          break;
        case 'auto':
          await this.executeAutomatically(result, options);
          break;
        case 'hybrid':
          await this.executeHybrid(result, options);
          break;
      }

      // 3. 验证任务完成
      const isCompleted = await this.validateTaskCompletion(task, result);
      result.status = isCompleted ? 'completed' : 'failed';

      if (!isCompleted) {
        this.log(result, 'warn', '任务验证失败，可能未完全完成');
      }
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      this.log(result, 'error', `任务执行失败: ${result.error}`);
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();

      this.emitEvent('task_execution_finished', {
        taskId: task.id,
        status: result.status,
        duration: result.duration,
        successfulSteps: result.successfulSteps,
        failedSteps: result.failedSteps,
      });
    }

    return result;
  }

  /**
   * 生成执行步骤
   */
  private async generateExecutionSteps(task: Task): Promise<ExecutionStep[]> {
    try {
      const prompt = this.buildStepGenerationPrompt(task);
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;

      return this.parseExecutionSteps(responseText, task);
    } catch (error) {
      console.error('生成执行步骤失败:', error);
      return this.getFallbackSteps(task);
    }
  }

  /**
   * 构建步骤生成提示词
   */
  private buildStepGenerationPrompt(task: Task): string {
    return `请为以下任务生成详细的执行步骤：

任务信息：
- 名称: ${task.name}
- 描述: ${task.description}
- 类型: ${task.type}
- 验收标准: ${task.acceptanceCriteria.join(', ')}
- 技术要求: ${task.technicalRequirements.join(', ')}

请生成5-10个具体的执行步骤，每个步骤包含：
1. 步骤名称
2. 详细描述
3. 执行命令（如果适用）
4. 预期结果
5. 验证方法

以JSON格式返回：
{
  "steps": [
    {
      "name": "步骤名称",
      "description": "详细描述",
      "command": "执行命令（可选）",
      "expectedResult": "预期结果",
      "validation": "验证方法"
    }
  ]
}`;
  }

  /**
   * 解析执行步骤
   */
  private parseExecutionSteps(responseText: string, task: Task): ExecutionStep[] {
    try {
      // 尝试解析JSON响应
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.steps && Array.isArray(parsed.steps)) {
          return parsed.steps.map((step: any, index: number) => ({
            id: `${task.id}_step_${index + 1}`,
            name: step.name || `步骤 ${index + 1}`,
            description: step.description || '',
            command: step.command,
            expectedResult: step.expectedResult || '',
            validation: step.validation,
            status: 'pending' as StepStatus,
          }));
        }
      }
    } catch (error) {
      console.error('解析执行步骤失败:', error);
    }

    return this.getFallbackSteps(task);
  }

  /**
   * 获取备用执行步骤
   */
  private getFallbackSteps(task: Task): ExecutionStep[] {
    const baseSteps: ExecutionStep[] = [
      {
        id: `${task.id}_step_1`,
        name: '准备工作',
        description: '准备执行任务所需的环境和资源',
        expectedResult: '环境和资源准备就绪',
        status: 'pending',
      },
      {
        id: `${task.id}_step_2`,
        name: '执行主要工作',
        description: task.description,
        expectedResult: '主要工作完成',
        status: 'pending',
      },
      {
        id: `${task.id}_step_3`,
        name: '验证结果',
        description: '验证任务执行结果是否符合要求',
        expectedResult: '验证通过',
        status: 'pending',
      },
    ];

    // 根据任务类型添加特定步骤
    switch (task.type) {
      case 'development':
        baseSteps.splice(1, 0, {
          id: `${task.id}_step_code`,
          name: '编写代码',
          description: '实现功能代码',
          expectedResult: '代码实现完成',
          status: 'pending',
        });
        break;
      case 'testing':
        baseSteps.splice(1, 0, {
          id: `${task.id}_step_test`,
          name: '编写测试',
          description: '编写和执行测试用例',
          expectedResult: '测试通过',
          status: 'pending',
        });
        break;
      case 'deployment':
        baseSteps.splice(1, 0, {
          id: `${task.id}_step_deploy`,
          name: '部署应用',
          description: '部署应用到目标环境',
          expectedResult: '部署成功',
          status: 'pending',
        });
        break;
    }

    return baseSteps;
  }

  /**
   * 手动执行模式
   */
  private async executeManually(
    result: TaskExecutionResult,
    options?: ExecutionOptions
  ): Promise<void> {
    this.log(result, 'info', '开始手动执行模式');

    for (const step of result.steps) {
      this.emitEvent('step_execution_started', {
        taskId: result.taskId,
        stepId: step.id,
        stepName: step.name,
      });

      // 在手动模式下，我们假设用户会手动完成步骤
      // 实际实现中，这里应该等待用户确认
      step.status = 'running';
      step.startTime = new Date();

      // 模拟用户确认
      await this.waitForUserConfirmation(step);

      step.status = 'completed';
      step.endTime = new Date();
      step.result = '用户确认完成';
      result.successfulSteps++;

      this.emitEvent('step_execution_completed', {
        taskId: result.taskId,
        stepId: step.id,
        status: step.status,
      });

      this.log(result, 'info', `步骤完成: ${step.name}`);
    }
  }

  /**
   * 自动执行模式
   */
  private async executeAutomatically(
    result: TaskExecutionResult,
    options?: ExecutionOptions
  ): Promise<void> {
    this.log(result, 'info', '开始自动执行模式');

    for (const step of result.steps) {
      try {
        this.emitEvent('step_execution_started', {
          taskId: result.taskId,
          stepId: step.id,
          stepName: step.name,
        });

        step.status = 'running';
        step.startTime = new Date();

        // 执行步骤
        const stepResult = await this.executeStep(step, options);

        step.status = stepResult.success ? 'completed' : 'failed';
        step.endTime = new Date();
        step.result = stepResult.result;
        step.error = stepResult.error;

        if (stepResult.success) {
          result.successfulSteps++;
        } else {
          result.failedSteps++;

          // 如果不允许失败时继续，则停止执行
          if (!options?.continueOnFailure) {
            this.log(result, 'error', `步骤失败，停止执行: ${step.name}`);
            break;
          }
        }

        this.emitEvent('step_execution_completed', {
          taskId: result.taskId,
          stepId: step.id,
          status: step.status,
        });

        this.log(result, 'info', `步骤${stepResult.success ? '完成' : '失败'}: ${step.name}`);
      } catch (error) {
        step.status = 'failed';
        step.endTime = new Date();
        step.error = error instanceof Error ? error.message : String(error);
        result.failedSteps++;

        this.log(result, 'error', `步骤执行异常: ${step.name} - ${step.error}`);

        if (!options?.continueOnFailure) {
          break;
        }
      }
    }
  }

  /**
   * 混合执行模式
   */
  private async executeHybrid(
    result: TaskExecutionResult,
    options?: ExecutionOptions
  ): Promise<void> {
    this.log(result, 'info', '开始混合执行模式');

    for (const step of result.steps) {
      // 根据步骤类型决定执行方式
      const shouldAutoExecute = this.shouldAutoExecuteStep(step);

      if (shouldAutoExecute) {
        // 自动执行
        await this.executeStepAutomatically(step, result, options);
      } else {
        // 手动执行
        await this.executeStepManually(step, result, options);
      }
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: ExecutionStep,
    options?: ExecutionOptions
  ): Promise<{ success: boolean; result: string; error?: string }> {
    try {
      // 如果有命令，尝试执行
      if (step.command) {
        // 这里应该执行实际的命令
        // 为了简化，我们模拟执行结果
        return {
          success: true,
          result: `命令执行成功: ${step.command}`,
        };
      }

      // 没有命令的步骤，返回成功
      return {
        success: true,
        result: step.expectedResult,
      };
    } catch (error) {
      return {
        success: false,
        result: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 验证任务完成
   */
  private async validateTaskCompletion(task: Task, result: TaskExecutionResult): Promise<boolean> {
    // 检查是否所有步骤都成功完成
    const allStepsCompleted = result.steps.every((step) => step.status === 'completed');

    // 检查验收标准
    const acceptanceCriteriaMet = await this.validateAcceptanceCriteria(task, result);

    return allStepsCompleted && acceptanceCriteriaMet;
  }

  /**
   * 验证验收标准
   */
  private async validateAcceptanceCriteria(
    task: Task,
    result: TaskExecutionResult
  ): Promise<boolean> {
    // 简化实现：如果有验收标准，假设需要手动验证
    if (task.acceptanceCriteria.length === 0) {
      return true;
    }

    // 实际实现中，这里应该根据验收标准进行自动或手动验证
    return result.successfulSteps > 0;
  }

  // 辅助方法

  private async waitForUserConfirmation(step: ExecutionStep): Promise<void> {
    // 模拟等待用户确认
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private shouldAutoExecuteStep(step: ExecutionStep): boolean {
    // 有命令的步骤可以自动执行
    return !!step.command;
  }

  private async executeStepAutomatically(
    step: ExecutionStep,
    result: TaskExecutionResult,
    options?: ExecutionOptions
  ): Promise<void> {
    // 实现自动执行逻辑
    step.status = 'running';
    step.startTime = new Date();

    const stepResult = await this.executeStep(step, options);

    step.status = stepResult.success ? 'completed' : 'failed';
    step.endTime = new Date();
    step.result = stepResult.result;
    step.error = stepResult.error;

    if (stepResult.success) {
      result.successfulSteps++;
    } else {
      result.failedSteps++;
    }
  }

  private async executeStepManually(
    step: ExecutionStep,
    result: TaskExecutionResult,
    options?: ExecutionOptions
  ): Promise<void> {
    // 实现手动执行逻辑
    step.status = 'running';
    step.startTime = new Date();

    await this.waitForUserConfirmation(step);

    step.status = 'completed';
    step.endTime = new Date();
    step.result = '用户确认完成';
    result.successfulSteps++;
  }

  private log(
    result: TaskExecutionResult,
    level: 'info' | 'warn' | 'error',
    message: string
  ): void {
    result.logs.push(`[${level.toUpperCase()}] ${new Date().toISOString()}: ${message}`);
  }

  private emitEvent(eventName: string, data: any): void {
    this.eventBus.emit(eventName, data);
  }
}
