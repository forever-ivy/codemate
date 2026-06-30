import { nanoid } from 'nanoid';
import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowResult,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowStepStatus,
  WorkflowStatistics,
} from './types.js';

/**
 * 工作流管理器
 *
 * 职责：
 * 1. 管理工作流定义
 * 2. 执行工作流步骤
 * 3. 跟踪执行状态
 * 4. 处理错误和重试
 * 5. 提供进度反馈
 */
export class WorkflowManager {
  private workflows = new Map<string, WorkflowDefinition>();
  private runningWorkflows = new Map<string, WorkflowExecution>();

  constructor(private systemManager: any) {}

  /**
   * 注册工作流
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
    console.log(`📋 注册工作流: ${workflow.name} (${workflow.id})`);
  }

  /**
   * 获取工作流定义
   */
  getWorkflow(workflowId: string): WorkflowDefinition | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * 获取所有可用工作流
   */
  getAvailableWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(workflowId: string, context: WorkflowContext): Promise<WorkflowResult> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }

    const executionId = nanoid();
    const startTime = new Date();

    console.log(`🚀 开始执行工作流: ${workflow.name} (${executionId})`);

    // 创建执行上下文
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflow,
      context,
      status: 'running',
      startTime,
      stepResults: new Map(),
      currentStepIndex: 0,
    };

    this.runningWorkflows.set(executionId, execution);

    try {
      // 发送工作流开始事件
      this.systemManager.eventBus.emit('workflow_started', {
        executionId,
        workflowId,
        workflowName: workflow.name,
        timestamp: startTime,
      });

      // 执行工作流步骤
      const result = await this.executeWorkflowSteps(execution);

      // 清理执行上下文
      this.runningWorkflows.delete(executionId);

      // 发送工作流完成事件
      this.systemManager.eventBus.emit('workflow_completed', {
        executionId,
        workflowId,
        workflowName: workflow.name,
        status: result.status,
        duration: result.endTime ? result.endTime.getTime() - startTime.getTime() : 0,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      // 更新执行状态
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);

      // 清理执行上下文
      this.runningWorkflows.delete(executionId);

      // 发送工作流失败事件
      this.systemManager.eventBus.emit('workflow_failed', {
        executionId,
        workflowId,
        workflowName: workflow.name,
        error: execution.error,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * 暂停工作流
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.runningWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`工作流执行不存在: ${executionId}`);
    }

    execution.status = 'paused';
    console.log(`⏸️  暂停工作流: ${execution.workflow.name} (${executionId})`);
  }

  /**
   * 恢复工作流
   */
  async resumeWorkflow(executionId: string): Promise<WorkflowResult> {
    const execution = this.runningWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`工作流执行不存在: ${executionId}`);
    }

    if (execution.status !== 'paused') {
      throw new Error(`工作流状态不正确: ${execution.status}`);
    }

    execution.status = 'running';
    console.log(`▶️  恢复工作流: ${execution.workflow.name} (${executionId})`);

    // 继续执行剩余步骤
    try {
      const result = await this.executeWorkflowSteps(execution);
      this.runningWorkflows.delete(executionId);
      return result;
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * 取消工作流
   */
  async cancelWorkflow(executionId: string): Promise<void> {
    const execution = this.runningWorkflows.get(executionId);
    if (!execution) {
      throw new Error(`工作流执行不存在: ${executionId}`);
    }

    execution.status = 'cancelled';
    this.runningWorkflows.delete(executionId);

    console.log(`❌ 取消工作流: ${execution.workflow.name} (${executionId})`);
  }

  /**
   * 获取工作流状态
   */
  getWorkflowStatus(executionId: string): WorkflowStatus | null {
    const execution = this.runningWorkflows.get(executionId);
    return execution ? execution.status : null;
  }

  /**
   * 获取正在运行的工作流
   */
  getRunningWorkflows(): WorkflowExecution[] {
    return Array.from(this.runningWorkflows.values());
  }

  // ===== 私有方法 =====

  /**
   * 执行工作流步骤
   */
  private async executeWorkflowSteps(execution: WorkflowExecution): Promise<WorkflowResult> {
    const { workflow, context } = execution;
    const stepResults = new Map<string, WorkflowStepResult>();

    // 构建步骤依赖图
    const dependencyGraph = this.buildDependencyGraph(workflow.steps);
    const executionOrder = this.topologicalSort(dependencyGraph);

    for (const stepId of executionOrder) {
      // 检查是否被暂停或取消
      if (execution.status === 'paused') {
        break;
      }
      if (execution.status === 'cancelled') {
        break;
      }

      const step = workflow.steps.find((s) => s.id === stepId);
      if (!step) {
        continue;
      }

      // 检查步骤依赖是否满足
      if (!this.checkStepDependencies(step, stepResults)) {
        if (!step.optional) {
          throw new Error(`步骤依赖未满足: ${step.name}`);
        }
        // 跳过可选步骤
        stepResults.set(stepId, {
          stepId,
          status: 'skipped',
          startTime: new Date(),
          endTime: new Date(),
          outputs: {},
          retryCount: 0,
        });
        continue;
      }

      // 执行步骤
      const stepResult = await this.executeStep(step, context, execution);
      stepResults.set(stepId, stepResult);

      // 如果步骤失败且不允许继续
      if (stepResult.status === 'failed' && !workflow.config.continueOnFailure) {
        execution.status = 'failed';
        break;
      }
    }

    // 计算最终状态
    const finalStatus = this.calculateFinalStatus(execution.status, stepResults);
    const endTime = new Date();

    // 计算统计信息
    const statistics = this.calculateStatistics(stepResults, execution.startTime, endTime);

    const result: WorkflowResult = {
      workflowId: execution.id,
      status: finalStatus,
      startTime: execution.startTime,
      endTime,
      stepResults,
      outputs: this.collectOutputs(stepResults),
      error: execution.error,
      statistics,
    };

    return result;
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    execution: WorkflowExecution
  ): Promise<WorkflowStepResult> {
    const startTime = new Date();
    let retryCount = 0;
    const maxRetries = step.retryCount || 0;

    console.log(`🔄 执行步骤: ${step.name} (${step.id})`);

    while (retryCount <= maxRetries) {
      try {
        // 发送步骤开始事件
        this.systemManager.eventBus.emit('workflow_step_started', {
          executionId: execution.id,
          stepId: step.id,
          stepName: step.name,
          retryCount,
          timestamp: new Date(),
        });

        // 根据步骤类型执行相应逻辑
        const outputs = await this.executeStepByType(step, context);

        const endTime = new Date();
        const result: WorkflowStepResult = {
          stepId: step.id,
          status: 'completed',
          startTime,
          endTime,
          outputs,
          retryCount,
        };

        // 发送步骤完成事件
        this.systemManager.eventBus.emit('workflow_step_completed', {
          executionId: execution.id,
          stepId: step.id,
          stepName: step.name,
          duration: endTime.getTime() - startTime.getTime(),
          timestamp: endTime,
        });

        console.log(`✅ 步骤完成: ${step.name}`);
        return result;
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);

        console.warn(`⚠️  步骤执行失败: ${step.name} (重试 ${retryCount}/${maxRetries + 1})`);

        if (retryCount > maxRetries) {
          // 发送步骤失败事件
          this.systemManager.eventBus.emit('workflow_step_failed', {
            executionId: execution.id,
            stepId: step.id,
            stepName: step.name,
            error: errorMessage,
            retryCount,
            timestamp: new Date(),
          });

          return {
            stepId: step.id,
            status: 'failed',
            startTime,
            endTime: new Date(),
            outputs: {},
            error: errorMessage,
            retryCount,
          };
        }

        // 等待重试间隔
        await this.delay(1000 * retryCount); // 递增延迟
      }
    }

    // 这里不应该到达，但为了类型安全
    throw new Error(`步骤执行异常: ${step.name}`);
  }

  /**
   * 根据步骤类型执行相应逻辑
   */
  private async executeStepByType(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    switch (step.type) {
      case 'brainstorm':
        return await this.executeBrainstormStep(step, context);
      case 'plan':
        return await this.executePlanStep(step, context);
      case 'execute':
        return await this.executeExecutionStep(step, context);
      case 'document':
        return await this.executeDocumentStep(step, context);
      case 'validate':
        return await this.executeValidateStep(step, context);
      case 'notify':
        return await this.executeNotifyStep(step, context);
      case 'custom':
        return await this.executeCustomStep(step, context);
      default:
        throw new Error(`不支持的步骤类型: ${step.type}`);
    }
  }

  /**
   * 执行头脑风暴步骤
   */
  private async executeBrainstormStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    // 调用头脑风暴功能
    const specManager = this.systemManager.getSpecManager();

    // 创建规格文档
    const spec = await specManager.create({
      title: context.project.name,
      description: context.project.description,
      projectPath: context.project.path,
    });

    return {
      specId: spec.id,
      spec,
    };
  }

  /**
   * 执行计划步骤
   */
  private async executePlanStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    const planManager = this.systemManager.getPlanManager();
    const specId = step.config.parameters.specId || context.project.spec?.id;

    if (!specId) {
      throw new Error('缺少规格文档ID');
    }

    const spec = await this.systemManager.getSpecManager().get(specId);
    if (!spec) {
      throw new Error(`规格文档不存在: ${specId}`);
    }

    // 生成实施计划
    const plan = await planManager.generatePlan(spec, {
      detailLevel: 'detailed',
      teamSize: context.project.metadata.teamSize,
      complexity: context.project.metadata.complexity,
      includeRiskAssessment: true,
      includeResourceAllocation: true,
    });

    return {
      planId: plan.id,
      plan,
    };
  }

  /**
   * 执行执行步骤
   */
  private async executeExecutionStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    const executionTracker = this.systemManager.getExecutionTracker();
    const planId = step.config.parameters.planId || context.project.plan?.id;

    if (!planId) {
      throw new Error('缺少实施计划ID');
    }

    const plan = await this.systemManager.getPlanManager().get(planId);
    if (!plan) {
      throw new Error(`实施计划不存在: ${planId}`);
    }

    // 创建执行会话
    const session = await this.systemManager.getPlanManager().createExecutionSession(planId, {
      name: `${context.project.name} - 执行会话`,
      description: '自动创建的执行会话',
      autoStart: true,
    });

    // 开始跟踪执行
    await executionTracker.startTracking(session, plan);

    return {
      sessionId: session.id,
      session,
    };
  }

  /**
   * 执行文档步骤
   */
  private async executeDocumentStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    const designGenerator = this.systemManager.getDesignGenerator();
    const specId = step.config.parameters.specId || context.project.spec?.id;

    if (!specId) {
      throw new Error('缺少规格文档ID');
    }

    const spec = await this.systemManager.getSpecManager().get(specId);
    if (!spec) {
      throw new Error(`规格文档不存在: ${specId}`);
    }

    // 生成设计文档
    const document = await designGenerator.generate(spec, {
      type: 'complete',
      options: {
        detailLevel: 'detailed',
        language: 'zh',
        style: 'technical',
      },
    });

    return {
      documentId: document.id,
      document,
    };
  }

  /**
   * 执行验证步骤
   */
  private async executeValidateStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    // 执行验证逻辑
    return {
      validated: true,
      validationResults: [],
    };
  }

  /**
   * 执行通知步骤
   */
  private async executeNotifyStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    // 发送通知
    console.log(`📢 通知: ${step.config.parameters.message || '工作流步骤完成'}`);
    return {
      notified: true,
    };
  }

  /**
   * 执行自定义步骤
   */
  private async executeCustomStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<Record<string, any>> {
    // 执行自定义逻辑
    throw new Error('自定义步骤需要具体实现');
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(steps: WorkflowStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const step of steps) {
      graph.set(step.id, step.dependencies);
    }

    return graph;
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const dependencies = graph.get(nodeId) || [];

      for (const depId of dependencies) {
        visit(depId);
      }

      result.push(nodeId);
    };

    for (const nodeId of graph.keys()) {
      visit(nodeId);
    }

    return result;
  }

  /**
   * 检查步骤依赖
   */
  private checkStepDependencies(
    step: WorkflowStep,
    stepResults: Map<string, WorkflowStepResult>
  ): boolean {
    for (const depId of step.dependencies) {
      const depResult = stepResults.get(depId);
      if (!depResult || depResult.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * 计算最终状态
   */
  private calculateFinalStatus(
    executionStatus: WorkflowStatus,
    stepResults: Map<string, WorkflowStepResult>
  ): WorkflowStatus {
    if (executionStatus === 'cancelled') {
      return 'cancelled';
    }

    if (executionStatus === 'paused') {
      return 'paused';
    }

    const results = Array.from(stepResults.values());
    const hasFailures = results.some((r) => r.status === 'failed');

    if (hasFailures) {
      return 'failed';
    }

    return 'completed';
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    stepResults: Map<string, WorkflowStepResult>,
    startTime: Date,
    endTime: Date
  ): WorkflowStatistics {
    const results = Array.from(stepResults.values());
    const totalSteps = results.length;
    const completedSteps = results.filter((r) => r.status === 'completed').length;
    const failedSteps = results.filter((r) => r.status === 'failed').length;
    const skippedSteps = results.filter((r) => r.status === 'skipped').length;

    const totalDuration = endTime.getTime() - startTime.getTime();
    const averageStepDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;

    return {
      totalSteps,
      completedSteps,
      failedSteps,
      skippedSteps,
      totalDuration,
      averageStepDuration,
    };
  }

  /**
   * 收集输出
   */
  private collectOutputs(stepResults: Map<string, WorkflowStepResult>): Record<string, any> {
    const outputs: Record<string, any> = {};

    for (const [stepId, result] of stepResults) {
      outputs[stepId] = result.outputs;
    }

    return outputs;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 工作流执行上下文
 */
interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflow: WorkflowDefinition;
  context: WorkflowContext;
  status: WorkflowStatus;
  startTime: Date;
  endTime?: Date;
  stepResults: Map<string, WorkflowStepResult>;
  currentStepIndex: number;
  error?: string;
}
