import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileAgent } from '../../../src/agents/FileAgent';
import { Agent } from '../../../src/agents/base/Agent';
import { AgentManager } from '../../../src/managers/AgentManager';
import { AgentSource } from '../../../src/types/index';
import type { AgentContext, AgentDefinition, Result, Task } from '../../../src/types/index';

// 测试 Agent
class TestAgent extends Agent {
  name = 'test';
  description = 'Test agent';
  whenToUse = 'For testing';

  async execute(_task: Task, _context: AgentContext): Promise<Result> {
    return {
      success: true,
      data: { message: 'Test completed' },
    };
  }
}

describe('AgentManager', () => {
  let agentManager: AgentManager;
  let mockContext: AgentContext;

  beforeEach(() => {
    mockContext = {
      toolManager: {
        list: vi.fn(() => ['read', 'write', 'bash', 'glob', 'grep']),
        getAllTools: vi.fn(() => [
          { name: 'read' },
          { name: 'write' },
          { name: 'bash' },
          { name: 'glob' },
          { name: 'grep' },
        ]),
      },
      sessionService: {},
      eventBus: {},
    } as unknown as AgentContext;

    agentManager = new AgentManager(mockContext);
  });

  describe('register', () => {
    it('should register agent', () => {
      const agent = new TestAgent();
      agentManager.register(agent, AgentSource.Builtin);

      expect(agentManager.has('test')).toBe(true);
    });

    it('should override agent with higher priority', () => {
      const agent1 = new TestAgent();
      const agent2 = new TestAgent();

      agentManager.register(agent1, AgentSource.Builtin);
      agentManager.register(agent2, AgentSource.Project);

      expect(agentManager.count()).toBe(1);
    });

    it('should not override agent with lower priority', () => {
      const agent1 = new TestAgent();
      const agent2 = new TestAgent();

      agentManager.register(agent1, AgentSource.Project);
      agentManager.register(agent2, AgentSource.Builtin);

      expect(agentManager.count()).toBe(1);
    });
  });

  describe('delegate', () => {
    it('should delegate task to agent', async () => {
      const agent = new TestAgent();
      agentManager.register(agent, AgentSource.Builtin);

      const result = await agentManager.delegate(
        {
          type: 'test',
          goal: 'Test goal',
        },
        'test'
      );

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Test completed');
    });

    it('should throw error when delegating to non-existent agent', async () => {
      await expect(
        agentManager.delegate(
          {
            type: 'test',
            goal: 'Test goal',
          },
          'non-existent'
        )
      ).rejects.toThrow('Agent not found');
    });

    it('should execute delegated agents with isolation metadata', async () => {
      class ContextProbeAgent extends Agent {
        name = 'explore';
        description = '探索代码库结构';
        whenToUse = '分析代码库结构时使用';

        async execute(_task: Task, context: AgentContext): Promise<Result> {
          return {
            success: true,
            data: {
              isolation: context.isolation,
              tools: context.toolManager.list(),
            },
          };
        }
      }

      agentManager.register(new ContextProbeAgent(), AgentSource.Builtin);

      const result = await agentManager.delegate(
        {
          type: 'subagent',
          goal: '分析代码库结构',
          context: {
            parentRunId: 'agent-run-1',
            contextSummary: 'Repo map selected agent files.',
          },
        },
        'explore'
      );

      expect(result.data).toEqual({
        isolation: {
          agentName: 'explore',
          parentRunId: 'agent-run-1',
          allowedTools: ['read', 'write', 'bash', 'glob', 'grep'],
          disallowedTools: [],
          contextSummary: 'Repo map selected agent files.',
        },
        tools: ['read', 'write', 'bash', 'glob', 'grep'],
      });
    });
  });

  describe('selectSubagent', () => {
    it('should recommend a focused agent without executing it', () => {
      const exploreAgent = new TestAgent();
      exploreAgent.name = 'explore';
      exploreAgent.description = '探索代码库结构，识别关键文件';
      exploreAgent.whenToUse = '需要理解代码库结构或查找特定功能时使用';
      agentManager.register(exploreAgent, AgentSource.Builtin);

      const decision = agentManager.selectSubagent('分析代码库结构并找出关键文件');

      expect(decision?.agentName).toBe('explore');
    });
  });

  describe('getAvailableTools', () => {
    it('should return all tools for builtin agent', () => {
      const agent = new TestAgent();
      agentManager.register(agent, AgentSource.Builtin);

      const tools = agentManager.getAvailableTools('test');
      expect(tools).toEqual(['read', 'write', 'bash', 'glob', 'grep']);
    });

    it('should filter tools by whitelist', () => {
      const definition: AgentDefinition = {
        name: 'test-file',
        description: 'Test file agent',
        tools: ['read', 'glob', 'grep'],
        systemPrompt: 'Test',
        source: AgentSource.Project,
        path: '/test/path',
      };

      const agent = new FileAgent(definition);
      agentManager.register(agent, AgentSource.Project);

      const tools = agentManager.getAvailableTools('test-file');
      expect(tools).toEqual(['read', 'glob', 'grep']);
    });

    it('should filter tools by blacklist', () => {
      const definition: AgentDefinition = {
        name: 'test-file',
        description: 'Test file agent',
        tools: ['*'],
        disallowedTools: ['bash', 'write'],
        systemPrompt: 'Test',
        source: AgentSource.Project,
        path: '/test/path',
      };

      const agent = new FileAgent(definition);
      agentManager.register(agent, AgentSource.Project);

      const tools = agentManager.getAvailableTools('test-file');
      expect(tools).toEqual(['read', 'glob', 'grep']);
    });
  });

  describe('listAll', () => {
    it('should list all agents with source info', () => {
      const agent1 = new TestAgent();
      const definition: AgentDefinition = {
        name: 'test-file',
        description: 'Test file agent',
        tools: ['read'],
        systemPrompt: 'Test',
        source: AgentSource.Project,
        path: '/test/path',
      };
      const agent2 = new FileAgent(definition);

      agentManager.register(agent1, AgentSource.Builtin);
      agentManager.register(agent2, AgentSource.Project);

      const agents = agentManager.listAll();
      expect(agents).toHaveLength(2);
      expect(agents[0].source).toBe(AgentSource.Builtin);
      expect(agents[1].source).toBe(AgentSource.Project);
      expect(agents[1].tools).toEqual(['read']);
    });
  });

  it('should list all agents', () => {
    agentManager.register(new TestAgent(), AgentSource.Builtin);

    const agents = agentManager.list();
    expect(agents).toContain('test');
  });

  it('should get agent info', () => {
    agentManager.register(new TestAgent(), AgentSource.Builtin);

    const info = agentManager.getAllInfo();
    expect(info).toHaveLength(1);
    expect(info[0].name).toBe('test');
  });

  it('should count agents', () => {
    agentManager.register(new TestAgent(), AgentSource.Builtin);

    expect(agentManager.count()).toBe(1);
  });
});
