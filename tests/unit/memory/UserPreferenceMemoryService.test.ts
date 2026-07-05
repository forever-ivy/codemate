import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { UserPreferenceMemoryService } from '../../../src/memory/UserPreferenceMemoryService';

describe('UserPreferenceMemoryService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  async function createService(options = {}) {
    tempDir = await mkdtemp(path.join(tmpdir(), 'user-preference-memory-'));
    return new UserPreferenceMemoryService(tempDir, options);
  }

  it('should return an empty prompt when the user preference file does not exist', async () => {
    const service = await createService();

    const memory = await service.build();

    expect(memory.entryCount).toBe(0);
    expect(memory.entries).toEqual([]);
    expect(memory.prompt).toBe('');
    expect(memory.filePath).toContain('memory/user-preferences.json');
  });

  it('should persist user preferences and format them for model input', async () => {
    const service = await createService({
      maxEntries: 4,
      maxCharsPerEntry: 120,
    });

    await service.add({
      id: 'up-1',
      category: 'communication',
      content: '用户偏好中文沟通，并希望回答直接进入执行。',
      source: 'manual',
    });
    await service.add({
      id: 'up-2',
      category: 'workflow',
      content: '每章完成后先运行验证，再提交并推送远端。',
    });

    const memory = await service.build();

    expect(memory.entryCount).toBe(2);
    expect(memory.entries.map((entry) => entry.id)).toEqual(['up-1', 'up-2']);
    expect(memory.prompt).toContain('## User Preferences');
    expect(memory.prompt).toContain('Stored preferences: 2');
    expect(memory.prompt).toContain(
      '- communication: 用户偏好中文沟通，并希望回答直接进入执行。 (source: manual)'
    );
    expect(memory.prompt).toContain('- workflow: 每章完成后先运行验证，再提交并推送远端。');
  });

  it('should filter empty preferences and truncate long preference content', async () => {
    const service = await createService({
      maxEntries: 1,
      maxCharsPerEntry: 12,
    });

    await service.save([
      {
        id: 'up-empty',
        category: 'coding',
        content: '   ',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'up-long',
        category: 'tooling',
        content: 'Always run focused tests before committing chapter implementation work.',
        createdAt: 2,
        updatedAt: 2,
      },
    ]);

    const memory = await service.build();

    expect(memory.entryCount).toBe(1);
    expect(memory.entries[0].id).toBe('up-long');
    expect(memory.prompt).toContain('- tooling: Always run f...');
    expect(memory.prompt).not.toContain('up-empty');
  });
});
