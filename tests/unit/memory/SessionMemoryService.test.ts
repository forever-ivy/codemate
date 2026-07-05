import { describe, expect, it } from 'vitest';
import { SessionMemoryService } from '../../../src/memory/SessionMemoryService';

describe('SessionMemoryService', () => {
  it('should build compact memory from recent user and assistant turns', () => {
    const service = new SessionMemoryService({
      maxTurns: 2,
      maxCharsPerMessage: 80,
    });

    const memory = service.build([
      { role: 'user', content: 'first request' },
      { role: 'assistant', content: 'first answer' },
      { role: 'user', content: 'fix ContextBuilderService tests' },
      { role: 'assistant', content: 'Updated ContextBuilderService and tests.' },
      { role: 'user', content: 'add CodeGraphService support' },
      { role: 'assistant', content: 'Added CodeGraphService and RepoMap integration.' },
    ]);

    expect(memory.entryCount).toBe(2);
    expect(memory.entries).toEqual([
      {
        turn: 2,
        user: 'fix ContextBuilderService tests',
        assistant: 'Updated ContextBuilderService and tests.',
      },
      {
        turn: 3,
        user: 'add CodeGraphService support',
        assistant: 'Added CodeGraphService and RepoMap integration.',
      },
    ]);
    expect(memory.prompt).toContain('## Session Memory');
    expect(memory.prompt).toContain('Recent turns: 2');
    expect(memory.prompt).toContain('fix ContextBuilderService tests');
    expect(memory.prompt).not.toContain('first request');
  });

  it('should return an empty prompt when there is no history', () => {
    const service = new SessionMemoryService();

    const memory = service.build([]);

    expect(memory.entryCount).toBe(0);
    expect(memory.entries).toEqual([]);
    expect(memory.prompt).toBe('');
  });

  it('should truncate long messages before formatting memory', () => {
    const service = new SessionMemoryService({
      maxCharsPerMessage: 12,
    });

    const memory = service.build([
      { role: 'user', content: 'please explain a very long previous request' },
      { role: 'assistant', content: 'this was a very long assistant response' },
    ]);

    expect(memory.prompt).toContain('please expla...');
    expect(memory.prompt).toContain('this was a v...');
  });
});
