import { Agent } from './base/Agent';
import type { Task, Result, AgentContext, AgentDefinition } from '../types/index';

/**
 * FileAgent - 从文件定义创建的 Agent
 *
 * 这是一个动态 Agent 类，根据文件定义创建实例
 * 与内置 Agent 不同，FileAgent 的行为完全由文件定义决定
 */
export class FileAgent extends Agent {
  name: string;
  description: string;
  whenToUse: string;

  // Agent 特有属性
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  forkContext?: boolean;
  color?: string;
  systemPrompt: string;

  constructor(definition: AgentDefinition) {
    super();
    this.name = definition.name;
    this.description = definition.description;
    this.whenToUse = definition.description; // 使用 description 作为 whenToUse
    this.tools = definition.tools;
    this.disallowedTools = definition.disallowedTools;
    this.model = definition.model;
    this.forkContext = definition.forkContext;
    this.color = definition.color;
    this.systemPrompt = definition.systemPrompt;
  }

  /**
   * 执行任务
   *
   * FileAgent 使用 systemPrompt 作为指令，
   * 通过 AI 模型执行任务
   */
  async execute(task: Task, _context: AgentContext): Promise<Result> {
    // 注意：这里简化实现，实际应该调用 AI 模型
    // 在真实场景中，需要：
    // 1. 获取可用工具（应用权限过滤）
    // 2. 构建消息（system prompt + user goal）
    // 3. 调用 AI 模型
    // 4. 处理工具调用
    // 5. 返回结果

    console.log(`🤖 FileAgent ${this.name} executing task...`);
    console.log(`   System Prompt: ${this.systemPrompt.substring(0, 50)}...`);
    console.log(`   Goal: ${task.goal}`);

    // 简化实现：直接返回成功
    return {
      success: true,
      data: {
        agent: this.name,
        message: `Task executed by ${this.name}`,
      },
      message: `Task completed by ${this.name}`,
    };
  }

  /**
   * 获取可用工具（应用权限过滤）
   *
   * 这个方法会被 AgentManager 调用
   */
  getAvailableTools(allTools: string[]): string[] {
    // 应用白名单
    let filtered = allTools;
    if (this.tools && this.tools.length > 0) {
      if (this.tools.includes('*')) {
        // 允许所有工具
        filtered = allTools;
      } else {
        // 只允许指定的工具
        filtered = allTools.filter((tool) => this.tools!.includes(tool));
      }
    }

    // 应用黑名单
    if (this.disallowedTools && this.disallowedTools.length > 0) {
      filtered = filtered.filter((tool) => !this.disallowedTools!.includes(tool));
    }

    return filtered;
  }
}
