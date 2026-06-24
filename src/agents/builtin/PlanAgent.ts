import { Agent } from '../base/Agent';
import type { Task, Result, AgentContext } from '../../types/index';

/**
 * PlanAgent - 规划型 Agent
 *
 * 职责：
 * 1. 分析任务需求
 * 2. 分解为子任务
 * 3. 生成执行计划
 *
 * 使用场景：
 * - 需要分解复杂任务时
 * - 制定实施方案
 * - 规划开发步骤
 */
export class PlanAgent extends Agent {
  name = 'plan';
  description = '分析任务需求，制定执行计划';
  whenToUse = '需要分解复杂任务或制定实施方案时使用';

  async execute(task: Task, _context: AgentContext): Promise<Result> {
    console.log('📋 开始制定计划...');

    try {
      // 1. 分析任务
      const analysis = await this.analyzeTask(task);

      // 2. 分解子任务
      const subtasks = await this.breakdownTask(task, analysis);

      // 3. 排序子任务
      const orderedTasks = this.orderTasks(subtasks);

      // 4. 生成计划
      const plan = this.generatePlan(orderedTasks);

      console.log('✅ 计划制定完成');

      return {
        success: true,
        data: {
          analysis,
          subtasks: orderedTasks,
          plan,
        },
        message: '执行计划已生成',
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 分析任务
   */
  private async analyzeTask(task: Task): Promise<any> {
    return {
      goal: task.goal,
      complexity: this.estimateComplexity(task.goal),
      requirements: this.extractRequirements(task.goal),
    };
  }

  /**
   * 分解任务
   */
  private async breakdownTask(task: Task, _analysis: any): Promise<any[]> {
    const subtasks: any[] = [];

    // 简单实现：根据关键词分解
    const keywords = ['创建', '修改', '删除', '测试', '部署'];

    for (const keyword of keywords) {
      if (task.goal.includes(keyword)) {
        subtasks.push({
          id: subtasks.length + 1,
          action: keyword,
          description: `${keyword}相关功能`,
          estimated: '30分钟',
        });
      }
    }

    // 如果没有匹配，添加默认任务
    if (subtasks.length === 0) {
      subtasks.push({
        id: 1,
        action: '执行',
        description: task.goal,
        estimated: '1小时',
      });
    }

    return subtasks;
  }

  /**
   * 排序任务
   */
  private orderTasks(subtasks: any[]): any[] {
    // 简单实现：按 id 排序
    return subtasks.sort((a, b) => a.id - b.id);
  }

  /**
   * 生成计划
   */
  private generatePlan(subtasks: any[]): string {
    let plan = '执行计划：\n\n';

    for (const task of subtasks) {
      plan += `${task.id}. ${task.action} - ${task.description}\n`;
      plan += `   预计时间：${task.estimated}\n\n`;
    }

    return plan;
  }

  /**
   * 估算复杂度
   */
  private estimateComplexity(goal: string): string {
    const length = goal.length;
    if (length < 50) return '简单';
    if (length < 100) return '中等';
    return '复杂';
  }

  /**
   * 提取需求
   */
  private extractRequirements(goal: string): string[] {
    // 简单实现：按句子分割
    return goal.split('。').filter((s) => s.trim());
  }
}
