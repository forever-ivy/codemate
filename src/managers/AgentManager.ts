import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import matter from 'gray-matter';
import { join } from 'pathe';
import { AgentContextIsolationService } from '../agents/AgentContextIsolationService';
import { FileAgent } from '../agents/FileAgent';
import { type SubagentDecision, SubagentTaskService } from '../agents/SubagentTaskService';
import type { Agent } from '../agents/base/Agent';
import { AgentSource } from '../types/index';
import type {
  AgentContext,
  AgentDefinition,
  AgentFrontmatter,
  AgentInfo,
  Result,
  Task,
} from '../types/index';

/**
 * AgentManager - Agent 管理器（增强版）
 *
 * 职责：
 * 1. 注册和管理 Agent
 * 2. 从文件加载自定义 Agent
 * 3. 委托任务给 Agent
 * 4. 管理工具权限
 * 5. 协调 Agent 之间的协作
 */
export class AgentManager {
  /**
   * Agent 存储
   *
   * key: Agent 名称
   * value: Agent 实例
   */
  private agents = new Map<string, Agent>();

  /**
   * Agent 来源存储
   *
   * key: Agent 名称
   * value: Agent 来源
   */
  private agentSources = new Map<string, AgentSource>();

  /**
   * 上下文
   */
  private context: AgentContext;
  private subagentTaskService = new SubagentTaskService();
  private contextIsolationService = new AgentContextIsolationService();

  constructor(context: AgentContext) {
    this.context = context;
  }

  /**
   * 加载所有 Agent
   *
   * 加载顺序（优先级从低到高）：
   * 1. Builtin (代码中定义) - 已通过 register() 注册
   * 2. Plugin (插件注册) - 通过 PluginManager 注册
   * 3. GlobalClaude (~/.claude/agents)
   * 4. Global (~/.aicli/agents)
   * 5. ProjectClaude (.claude/agents)
   * 6. Project (.aicli/agents)
   */
  async loadAgents(): Promise<void> {
    // 1. Builtin agents 已经通过 register() 注册
    // 2. Plugin agents 通过 PluginManager 注册

    // 3. GlobalClaude
    const globalClaudeDir = join(homedir(), '.claude', 'agents');
    await this.loadFromDirectory(globalClaudeDir, AgentSource.GlobalClaude);

    // 4. Global
    const globalDir = join(homedir(), '.aicli', 'agents');
    await this.loadFromDirectory(globalDir, AgentSource.Global);

    // 5. ProjectClaude
    const projectClaudeDir = join(process.cwd(), '.claude', 'agents');
    await this.loadFromDirectory(projectClaudeDir, AgentSource.ProjectClaude);

    // 6. Project
    const projectDir = join(process.cwd(), '.aicli', 'agents');
    await this.loadFromDirectory(projectDir, AgentSource.Project);

    console.log(`✅ Loaded ${this.agents.size} agents`);
  }

  /**
   * 从目录加载 Agent
   */
  private async loadFromDirectory(dir: string, source: AgentSource): Promise<void> {
    try {
      const files = await readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = join(dir, file);
        const content = await readFile(filePath, 'utf-8');

        try {
          const parsedData = this.parseAgentFile(content);
          const definition: AgentDefinition = {
            ...parsedData,
            source,
            path: filePath,
          };
          const agent = this.createAgentFromFile(definition);
          this.register(agent, source);
        } catch (error) {
          console.error(`Failed to load agent from ${filePath}:`, error);
        }
      }
    } catch (error) {
      // 目录不存在，忽略
    }
  }

  /**
   * 解析 Agent 文件
   */
  private parseAgentFile(content: string): Omit<AgentDefinition, 'source' | 'path'> {
    const { data, content: systemPrompt } = matter(content);
    const frontmatter = data as AgentFrontmatter;

    if (!frontmatter.name || !frontmatter.description) {
      throw new Error('Agent file must have name and description in frontmatter');
    }

    // 处理 tools（可能是字符串或数组）
    let tools: string[] | undefined;
    if (frontmatter.tools) {
      tools =
        typeof frontmatter.tools === 'string'
          ? frontmatter.tools.split(',').map((t) => t.trim())
          : frontmatter.tools;
    }

    // 处理 disallowedTools
    let disallowedTools: string[] | undefined;
    if (frontmatter.disallowedTools) {
      disallowedTools =
        typeof frontmatter.disallowedTools === 'string'
          ? frontmatter.disallowedTools.split(',').map((t) => t.trim())
          : frontmatter.disallowedTools;
    }

    return {
      name: frontmatter.name,
      description: frontmatter.description,
      tools,
      disallowedTools,
      model: frontmatter.model,
      forkContext: frontmatter.forkContext,
      color: frontmatter.color,
      systemPrompt: systemPrompt.trim(),
    };
  }

  /**
   * 从文件定义创建 Agent
   */
  private createAgentFromFile(definition: AgentDefinition): Agent {
    return new FileAgent(definition);
  }

  /**
   * 获取来源优先级
   */
  private getSourcePriority(source: AgentSource): number {
    const priorities: Record<AgentSource, number> = {
      [AgentSource.Builtin]: 1,
      [AgentSource.Plugin]: 2,
      [AgentSource.Config]: 2,
      [AgentSource.GlobalClaude]: 3,
      [AgentSource.Global]: 4,
      [AgentSource.ProjectClaude]: 5,
      [AgentSource.Project]: 6,
    };
    return priorities[source] || 0;
  }

  /**
   * 注册 Agent
   *
   * @param agent Agent 实例
   * @param source Agent 来源
   */
  register(agent: Agent, source: AgentSource = AgentSource.Builtin): void {
    // 如果已存在同名 Agent，检查优先级
    if (this.agents.has(agent.name)) {
      const existingSource = this.agentSources.get(agent.name);
      if (!existingSource) {
        throw new Error(`Missing source for registered agent: ${agent.name}`);
      }
      const existingPriority = this.getSourcePriority(existingSource);
      const newPriority = this.getSourcePriority(source);

      // 新来源优先级更高，覆盖旧的
      if (newPriority > existingPriority) {
        console.log(`⚠️  Overriding agent ${agent.name} (${existingSource} -> ${source})`);
      } else {
        // 优先级更低，忽略
        console.log(
          `⚠️  Ignoring agent ${agent.name} from ${source} (already exists from ${existingSource})`
        );
        return;
      }
    }

    this.agents.set(agent.name, agent);
    this.agentSources.set(agent.name, source);
    console.log(`✅ Agent registered: ${agent.name} (${source})`);
  }

  /**
   * 委托任务给 Agent
   *
   * @param task 任务
   * @param agentName Agent 名称
   * @returns 执行结果
   * @throws 如果 Agent 不存在
   */
  async delegate(task: Task, agentName: string): Promise<Result> {
    const agent = this.agents.get(agentName);

    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    console.log(`🤖 Delegating task to ${agentName}...`);
    console.log(`   Goal: ${task.goal}`);

    // 检查是否需要 fork context
    const shouldFork = agent instanceof FileAgent && agent.forkContext;

    try {
      let result: Result;

      const executionContext = this.createIsolatedContext(task, agentName);
      if (shouldFork) {
        result = await agent.execute(task, this.createForkedContext(executionContext));
      } else {
        result = await agent.execute(task, executionContext);
      }

      console.log(`✅ Task completed by ${agentName}`);
      return result;
    } catch (error) {
      console.error(`❌ Task failed in ${agentName}:`, error);
      throw error;
    }
  }

  /**
   * Select a focused subagent for a goal without executing it.
   *
   * This keeps routing separate from execution: callers can inspect the
   * decision, show it to the user, or pass it to a scheduler before delegating.
   */
  selectSubagent(goal: string): SubagentDecision | undefined {
    return this.subagentTaskService.select({
      goal,
      agents: this.getAllInfo(),
    });
  }

  /**
   * 创建独立上下文
   *
   * 用于 forkContext 功能
   */
  private createForkedContext(context: AgentContext): AgentContext {
    // 创建新的 SessionService 实例
    // 注意：这里简化实现，实际应该创建完整的独立上下文
    return {
      ...context,
      // sessionService: new SessionService(...), // 实际应该创建新实例
    };
  }

  private createIsolatedContext(task: Task, agentName: string): AgentContext {
    const taskContext = this.extractTaskContext(task);
    return this.contextIsolationService.build({
      parentContext: this.context,
      agentName,
      parentRunId: taskContext.parentRunId ?? 'unknown-parent-run',
      allowedTools: this.getAvailableTools(agentName),
      contextSummary: taskContext.contextSummary,
    });
  }

  private extractTaskContext(task: Task): { parentRunId?: string; contextSummary?: string } {
    if (!task.context || typeof task.context !== 'object') {
      return {};
    }

    const context = task.context as Record<string, unknown>;
    return {
      parentRunId: typeof context.parentRunId === 'string' ? context.parentRunId : undefined,
      contextSummary:
        typeof context.contextSummary === 'string' ? context.contextSummary : undefined,
    };
  }

  /**
   * 获取 Agent 可用的工具列表
   *
   * @param agentName Agent 名称
   * @returns 工具名称数组
   */
  getAvailableTools(agentName: string): string[] {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    // 如果是 FileAgent，使用其工具权限配置
    if (agent instanceof FileAgent) {
      const allTools = this.context.toolManager.list();
      return agent.getAvailableTools(allTools);
    }

    // Builtin Agent 返回所有工具
    return this.context.toolManager.list();
  }

  /**
   * 获取 Agent
   *
   * @param name Agent 名称
   * @returns Agent 实例
   */
  get(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * 检查 Agent 是否存在
   *
   * @param name Agent 名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * 列出所有 Agent
   *
   * @returns Agent 名称数组
   */
  list(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * 获取所有 Agent 的信息
   *
   * @returns Agent 信息数组
   */
  getAllInfo(): Array<{ name: string; description: string; whenToUse: string }> {
    return Array.from(this.agents.values()).map((agent) => agent.getInfo());
  }

  /**
   * 列出所有 Agent 信息（增强版）
   *
   * @returns Agent 信息数组（包含来源和配置）
   */
  listAll(): AgentInfo[] {
    return Array.from(this.agents.entries()).map(([name, agent]) => {
      const source = this.agentSources.get(name) ?? AgentSource.Builtin;
      const info: AgentInfo = {
        name: agent.name,
        description: agent.description,
        source,
      };

      // 如果是 FileAgent，添加额外信息
      if (agent instanceof FileAgent) {
        info.tools = agent.tools;
        info.disallowedTools = agent.disallowedTools;
        info.model = agent.model;
        info.forkContext = agent.forkContext;
        info.color = agent.color;
      }

      return info;
    });
  }

  /**
   * 获取 Agent 数量
   *
   * @returns Agent 数量
   */
  count(): number {
    return this.agents.size;
  }
}
