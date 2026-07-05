import { describe, expect, it } from 'vitest';
import { MemoryGovernanceService } from '../../../src/memory/MemoryGovernanceService';

describe('MemoryGovernanceService', () => {
  it('should drop expired memory entries before prompt injection', () => {
    const service = new MemoryGovernanceService({
      maxAgeMs: 100,
      now: () => 1_000,
    });

    const result = service.apply([
      {
        id: 'fresh',
        source: 'project',
        label: 'convention',
        content: '教程代码和文档保持一致。',
        score: 5,
        updatedAt: 950,
      },
      {
        id: 'expired',
        source: 'user-preference',
        label: 'workflow',
        content: '旧的临时偏好。',
        score: 4,
        updatedAt: 100,
      },
    ]);

    expect(result.entryCount).toBe(1);
    expect(result.entries.map((entry) => entry.id)).toEqual(['fresh']);
    expect(result.droppedEntries).toEqual([
      {
        id: 'expired',
        reason: 'expired',
      },
    ]);
    expect(result.prompt).toContain('Memory safety:');
    expect(result.prompt).toContain('- Dropped entries: 1');
    expect(result.prompt).not.toContain('旧的临时偏好');
  });

  it('should redact secrets and truncate long memory entries', () => {
    const service = new MemoryGovernanceService({
      maxCharsPerEntry: 64,
    });

    const result = service.apply([
      {
        id: 'secret',
        source: 'project',
        label: 'warning',
        content:
          'Never commit OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef into docs or tests.',
        score: 9,
      },
    ]);

    expect(result.entryCount).toBe(1);
    expect(result.redactionCount).toBe(1);
    expect(result.entries[0].content).toContain('[REDACTED_SECRET]');
    expect(result.entries[0].content).toContain('...');
    expect(result.entries[0].content).not.toContain('sk-1234567890abcdef');
    expect(result.prompt).toContain('- Redacted secrets: 1');
    expect(result.prompt).toContain('Never commit OPENAI_API_KEY=[REDACTED_SECRET]');
  });
});
