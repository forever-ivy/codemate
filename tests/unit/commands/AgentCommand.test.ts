import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommand } from '../../../src/commands/agent/AgentCommand';

describe('AgentCommand', () => {
  let agentCommand: AgentCommand;
  let mockAgentManager: any;
  let mockSessionService: any;
  let mockApp: any;

  beforeEach(() => {
    mockAgentManager = {
      listAll: vi.fn().mockReturnValue([]),
      has: vi.fn().mockReturnValue(false),
      delegate: vi.fn(),
    };

    mockSessionService = {
      addMessage: vi.fn().mockResolvedValue(undefined),
    };

    mockApp = {
      getContainer: vi.fn().mockReturnValue({
        get: vi.fn((serviceName: string) => {
          if (serviceName === 'session') {
            return mockSessionService;
          }
          return undefined;
        }),
      }),
    };

    agentCommand = new AgentCommand(mockAgentManager);
  });

  it('should show help in session when no args are provided', async () => {
    await agentCommand.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Agent Management Commands:'),
      })
    );
  });

  it('should list available agents in session', async () => {
    mockAgentManager.listAll.mockReturnValue([
      {
        name: 'explore',
        source: 'builtin',
        description: 'Explore the codebase',
      },
    ]);

    await agentCommand.execute(['list'], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('📋 Available Agents (1):'),
      })
    );
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('🤖 explore'),
      })
    );
  });

  it('should show not-found message when delegating to unknown agent', async () => {
    mockAgentManager.has.mockReturnValue(false);

    await agentCommand.execute(['unknown-agent', 'do', 'something'], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('❌ Agent not found: unknown-agent'),
      })
    );
  });
});
