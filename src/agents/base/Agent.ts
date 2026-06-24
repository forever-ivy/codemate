import type { Task, Result, AgentContext } from '../../types/index';

/**
 * Agent - 智能体基类
 *
 * 职责：
 * 1. 定义 Agent 的基本接口
 * 2. 提供通用的辅助方法
 * 3. 规范 Agent 的行为
 */
export abstract class Agent {
  /**
   * Agent 名称
   */
  abstract name: string;

  /**
   * Agent 描述
   */
  abstract description: string;

  /**
   * 何时使用此 Agent
   */
  abstract whenToUse: string;

  /**
   * 执行任务
   *
   * @param task 任务
   * @param context 上下文
   * @returns 执行结果
   */
  abstract execute(task: Task, context: AgentContext): Promise<Result>;

  /**
   * 获取 Agent 信息
   */
  getInfo(): { name: string; description: string; whenToUse: string } {
    return {
      name: this.name,
      description: this.description,
      whenToUse: this.whenToUse,
    };
  }
}
