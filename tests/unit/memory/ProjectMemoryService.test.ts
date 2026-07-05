import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectMemoryService } from '../../../src/memory/ProjectMemoryService';

describe('ProjectMemoryService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  async function createService(options = {}) {
    tempDir = await mkdtemp(path.join(tmpdir(), 'project-memory-'));
    return new ProjectMemoryService(tempDir, options);
  }

  it('should return an empty prompt when the project memory file does not exist', async () => {
    const service = await createService();

    const memory = await service.build();

    expect(memory.entryCount).toBe(0);
    expect(memory.entries).toEqual([]);
    expect(memory.prompt).toBe('');
    expect(memory.filePath).toContain('.aicli/memory/project-memory.json');
  });

  it('should persist project memories and format them for model input', async () => {
    const service = await createService({
      maxEntries: 4,
      maxCharsPerEntry: 120,
    });

    await service.add({
      id: 'pm-1',
      kind: 'convention',
      content: '教程代码要保持和真实实现一致，章节里要说明具体文件和插入位置。',
      source: 'docs/conventions.md',
    });
    await service.add({
      id: 'pm-2',
      kind: 'decision',
      content: 'Project Memory 存在仓库本地文件里，用来跨会话保留项目级经验。',
    });

    const memory = await service.build();

    expect(memory.entryCount).toBe(2);
    expect(memory.entries.map((entry) => entry.id)).toEqual(['pm-1', 'pm-2']);
    expect(memory.prompt).toContain('## Project Memory');
    expect(memory.prompt).toContain('Stored entries: 2');
    expect(memory.prompt).toContain(
      '- convention: 教程代码要保持和真实实现一致，章节里要说明具体文件和插入位置。 (source: docs/conventions.md)'
    );
    expect(memory.prompt).toContain(
      '- decision: Project Memory 存在仓库本地文件里，用来跨会话保留项目级经验。'
    );
  });

  it('should ignore entries with empty content and cap the formatted entry count', async () => {
    const service = await createService({
      maxEntries: 1,
      maxCharsPerEntry: 10,
    });

    await service.save([
      {
        id: 'pm-empty',
        kind: 'fact',
        content: '   ',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'pm-long',
        kind: 'warning',
        content: 'This is a long memory entry that should be shortened before prompt injection.',
        createdAt: 2,
        updatedAt: 2,
      },
    ]);

    const memory = await service.build();

    expect(memory.entryCount).toBe(1);
    expect(memory.entries[0].id).toBe('pm-long');
    expect(memory.prompt).toContain('- warning: This is a ...');
    expect(memory.prompt).not.toContain('pm-empty');
  });
});
