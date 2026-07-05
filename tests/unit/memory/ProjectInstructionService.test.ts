import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectInstructionService } from '../../../src/memory/ProjectInstructionService';

describe('ProjectInstructionService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  async function createWorkspace() {
    tempDir = await mkdtemp(path.join(tmpdir(), 'project-instructions-'));
    await mkdir(path.join(tempDir, 'src', 'features'), { recursive: true });
    return tempDir;
  }

  it('should return an empty prompt when no AGENTS.md files exist', async () => {
    const cwd = await createWorkspace();
    const service = new ProjectInstructionService(cwd, {
      userInstructionPath: path.join(cwd, 'missing-user-AGENTS.md'),
    });

    const snapshot = await service.build(path.join(cwd, 'src', 'features'));

    expect(snapshot.entries).toEqual([]);
    expect(snapshot.prompt).toBe('');
  });

  it('should discover user, repository and directory instructions in priority order', async () => {
    const cwd = await createWorkspace();
    const userInstructionPath = path.join(cwd, 'user-AGENTS.md');
    await writeFile(userInstructionPath, 'Use Chinese for user-facing summaries.\n');
    await writeFile(path.join(cwd, 'AGENTS.md'), 'Run quality:release before commits.\n');
    await writeFile(
      path.join(cwd, 'src', 'AGENTS.md'),
      'Source changes must follow existing module boundaries.\n'
    );
    await writeFile(
      path.join(cwd, 'src', 'features', 'AGENTS.md'),
      'Feature code should include focused unit tests.\n'
    );

    const service = new ProjectInstructionService(cwd, {
      userInstructionPath,
      maxBytesPerFile: 200,
      maxTotalBytes: 1000,
    });

    const snapshot = await service.build(path.join(cwd, 'src', 'features'));

    expect(snapshot.entries.map((entry) => entry.scope)).toEqual([
      'user',
      'repository',
      'directory',
      'directory',
    ]);
    expect(snapshot.entries.map((entry) => entry.priority)).toEqual([0, 10, 20, 21]);
    expect(snapshot.entries.map((entry) => entry.path)).toEqual([
      userInstructionPath,
      'AGENTS.md',
      'src/AGENTS.md',
      'src/features/AGENTS.md',
    ]);
    expect(snapshot.prompt).toContain('## Project Instructions');
    expect(snapshot.prompt).toContain(
      'Priority: later entries override earlier project instruction entries'
    );
    expect(snapshot.prompt.indexOf('### user:')).toBeLessThan(
      snapshot.prompt.indexOf('### repository:')
    );
    expect(snapshot.prompt.indexOf('### repository:')).toBeLessThan(
      snapshot.prompt.indexOf('### directory: src/AGENTS.md')
    );
    expect(snapshot.prompt).toContain('Feature code should include focused unit tests.');
  });

  it('should truncate instruction files by per-file and total byte budgets', async () => {
    const cwd = await createWorkspace();
    await writeFile(path.join(cwd, 'AGENTS.md'), 'a'.repeat(100));
    await writeFile(path.join(cwd, 'src', 'AGENTS.md'), 'b'.repeat(100));

    const service = new ProjectInstructionService(cwd, {
      maxBytesPerFile: 20,
      maxTotalBytes: 30,
    });

    const snapshot = await service.build(path.join(cwd, 'src'));

    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[0]).toMatchObject({
      content: 'a'.repeat(20),
      truncated: true,
    });
    expect(snapshot.entries[1]).toMatchObject({
      content: 'b'.repeat(10),
      truncated: true,
    });
    expect(snapshot.prompt).toContain('truncated: true');
  });
});
