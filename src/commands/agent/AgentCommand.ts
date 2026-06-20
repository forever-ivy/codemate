import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';
import type { AgentManager } from '../../managers/AgentManager';
import type { SessionService } from '../../services/SessionService';

/**
 * AgentCommand - Agent 管理命令
 *
 * 用法：
 * - /agent list - 列出所有 Agent
 * - /agent <name> <goal> - 委托任务给指定 Agent
 */
export class AgentCommand extends SlashCommand {
  name = 'agent';
  description = 'Manage and use agents';
  usage = '/agent <list|name> [goal]';

  private agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    super();
    this.agentManager = agentManager;
  }

  async execute(args: string[], app: Application): Promise<void> {
    const sessionService = app.getContainer().get<SessionService>('session');

    // 如果没有参数，显示帮助
    if (args.length === 0) {
      await this.showHelp(sessionService);
      return;
    }

    const subcommand = args[0];

    // 列出所有 Agent
    if (subcommand === 'list') {
      await this.listAgents(sessionService);
      return;
    }

    // 委托任务给 Agent
    const agentName = subcommand;
    const goal = args.slice(1).join(' ');

    if (!goal) {
      await this.output(
        sessionService,
        `❌ Please provide a goal for the agent\nUsage: /agent ${agentName} <goal>`
      );
      return;
    }

    await this.delegateTask(agentName, goal, sessionService);
  }

  /**
   * 显示帮助信息
   */
  private async showHelp(sessionService?: SessionService): Promise<void> {
    await this.output(
      sessionService,
      [
        'Agent Management Commands:',
        '',
        '  /agent list              - List all available agents',
        '  /agent <name> <goal>     - Delegate a task to an agent',
        '',
        'Examples:',
        '  /agent list',
        '  /agent explore "Find all TypeScript files"',
        '  /agent general-purpose "Summarize current project status"',
      ].join('\n')
    );
  }

  /**
   * 列出所有 Agent
   */
  private async listAgents(sessionService?: SessionService): Promise<void> {
    const agents = this.agentManager.listAll();

    if (agents.length === 0) {
      await this.output(sessionService, 'No agents available');
      return;
    }

    const lines = [`📋 Available Agents (${agents.length}):`, ''];

    for (const agent of agents) {
      lines.push(`  🤖 ${agent.name} (${agent.source})`);
      lines.push(`     ${agent.description}`);

      if (agent.tools) {
        lines.push(`     Tools: ${agent.tools.join(', ')}`);
      }

      if (agent.disallowedTools) {
        lines.push(`     Disallowed: ${agent.disallowedTools.join(', ')}`);
      }

      if (agent.model) {
        lines.push(`     Model: ${agent.model}`);
      }

      if (agent.forkContext) {
        lines.push(`     Fork Context: ${agent.forkContext}`);
      }

      if (agent.color) {
        lines.push(`     Color: ${agent.color}`);
      }

      lines.push('');
    }

    await this.output(sessionService, lines.join('\n').trimEnd());
  }

  /**
   * 委托任务给 Agent
   */
  private async delegateTask(
    agentName: string,
    goal: string,
    sessionService?: SessionService
  ): Promise<void> {
    // 检查 Agent 是否存在
    if (!this.agentManager.has(agentName)) {
      await this.output(
        sessionService,
        `❌ Agent not found: ${agentName}\n💡 Use /agent list to see available agents`
      );
      return;
    }

    try {
      await this.output(sessionService, `🤖 Delegating task to ${agentName}...\nGoal: ${goal}`);

      const result = await this.agentManager.delegate(
        {
          type: 'custom',
          goal,
        },
        agentName
      );

      if (result.success) {
        let message = `✅ Task completed by ${agentName}`;
        if (result.message) {
          message += `\n${result.message}`;
        }
        if (result.data) {
          message += `\nData: ${JSON.stringify(result.data, null, 2)}`;
        }
        await this.output(sessionService, message);
      } else {
        let message = '❌ Task failed';
        if (result.message) {
          message += `\n${result.message}`;
        }
        await this.output(sessionService, message);
      }
    } catch (error) {
      await this.output(
        sessionService,
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async output(sessionService: SessionService | undefined, message: string): Promise<void> {
    if (sessionService) {
      await sessionService.addMessage({
        role: 'assistant',
        content: message,
      });
      return;
    }

    console.log(message);
  }
}
