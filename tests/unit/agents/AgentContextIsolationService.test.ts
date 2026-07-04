import { describe, expect, it, vi } from 'vitest';
import { AgentContextIsolationService } from '../../../src/agents/AgentContextIsolationService';
import type { AgentContext } from '../../../src/types/index';

describe('AgentContextIsolationService', () => {
  it('should expose only allowed tools to a subagent context', () => {
    const service = new AgentContextIsolationService();
    const parentContext = createParentContext();

    const context = service.build({
      parentContext,
      agentName: 'explore',
      parentRunId: 'agent-run-1',
      allowedTools: ['read_file', 'grep'],
      contextSummary: 'Only inspect repository files.',
    });

    expect(context.isolation).toEqual({
      agentName: 'explore',
      parentRunId: 'agent-run-1',
      allowedTools: ['read_file', 'grep'],
      disallowedTools: [],
      contextSummary: 'Only inspect repository files.',
    });
    expect(context.toolManager.list()).toEqual(['read_file', 'grep']);
    expect(context.toolManager.has('read_file')).toBe(true);
    expect(context.toolManager.has('bash')).toBe(false);
  });

  it('should reject disallowed tool execution before reaching the parent tool manager', async () => {
    const service = new AgentContextIsolationService();
    const parentContext = createParentContext();
    const context = service.build({
      parentContext,
      agentName: 'review',
      parentRunId: 'agent-run-2',
      allowedTools: ['read_file'],
    });

    await expect(context.toolManager.execute('bash', { command: 'rm -rf .' })).rejects.toThrow(
      'Tool not allowed for subagent review: bash'
    );
    expect(parentContext.toolManager.execute).not.toHaveBeenCalled();
  });

  it('should forward allowed tool execution to the parent tool manager', async () => {
    const service = new AgentContextIsolationService();
    const parentContext = createParentContext();
    const context = service.build({
      parentContext,
      agentName: 'explore',
      parentRunId: 'agent-run-3',
      allowedTools: ['read_file'],
    });

    const result = await context.toolManager.execute('read_file', { path: 'package.json' });

    expect(result).toEqual({ content: 'ok' });
    expect(parentContext.toolManager.execute).toHaveBeenCalledWith('read_file', {
      path: 'package.json',
    });
  });
});

function createParentContext(): AgentContext {
  const toolManager = {
    list: vi.fn(() => ['read_file', 'grep', 'bash', 'edit_file']),
    has: vi.fn((name: string) => ['read_file', 'grep', 'bash', 'edit_file'].includes(name)),
    get: vi.fn((name: string) => ({ name })),
    execute: vi.fn(async () => ({ content: 'ok' })),
    getAllTools: vi.fn(() => [
      { name: 'read_file' },
      { name: 'grep' },
      { name: 'bash' },
      { name: 'edit_file' },
    ]),
  };

  return {
    toolManager,
    sessionService: {},
    eventBus: {},
  } as unknown as AgentContext;
}
