import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiniHarnessService } from '../../../src/harness/MiniHarnessService';

describe('MiniHarnessService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-mini-harness-fixture');
  const workspaceRoot = path.join(process.cwd(), 'tmp-mini-harness-workspaces');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(fixtureDir, 'package.json'), '{"scripts":{"typecheck":"tsc"}}');
    await fs.writeFile(path.join(fixtureDir, 'src', 'index.ts'), 'export const value = 1;\n');
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  });

  it('should run a task in an isolated workspace and evaluate expected signals', async () => {
    const runner = vi.fn(async ({ workspaceDir }) => {
      await expect(fs.readFile(path.join(workspaceDir, 'src', 'index.ts'), 'utf-8')).resolves.toBe(
        'export const value = 1;\n'
      );

      return {
        success: true,
        modelInput:
          '## Repository Context\nRepository index:\nCode graph:\nRelevant file contents:',
        responseContent: 'Changed src/index.ts and verification passed.',
        changedFiles: ['src/index.ts'],
        verification: {
          success: true,
          summary: 'Verification passed.',
        },
      };
    });
    const service = new MiniHarnessService(runner, {
      workspaceRoot,
      keepWorkspaces: false,
    });

    const result = await service.runTask({
      id: 'context-smoke',
      title: 'Context smoke task',
      fixtureDir,
      userMessage: 'fix the context smoke task',
      expected: {
        modelInputIncludes: ['Repository index:', 'Code graph:', 'Relevant file contents:'],
        changedFiles: ['src/index.ts'],
        verificationSuccess: true,
        responseIncludes: ['verification passed'],
      },
    });

    expect(runner).toHaveBeenCalledWith({
      task: expect.objectContaining({ id: 'context-smoke' }),
      workspaceDir: path.join(workspaceRoot, 'context-smoke'),
    });
    expect(result.success).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'agent success', success: true }),
        expect.objectContaining({ name: 'model input includes: Code graph:', success: true }),
        expect.objectContaining({ name: 'changed file: src/index.ts', success: true }),
        expect.objectContaining({ name: 'verification success', success: true }),
      ])
    );
    await expect(fs.access(result.workspaceDir)).rejects.toThrow();
  });

  it('should report failed checks without throwing', async () => {
    const service = new MiniHarnessService(
      async () => ({
        success: true,
        modelInput: '## Repository Context',
        responseContent: 'Done.',
        changedFiles: [],
        verification: {
          success: false,
          summary: 'Verification failed.',
        },
      }),
      {
        workspaceRoot,
        keepWorkspaces: false,
      }
    );

    const result = await service.runTask({
      id: 'missing-signals',
      title: 'Missing signals task',
      fixtureDir,
      userMessage: 'fix missing signals',
      expected: {
        modelInputIncludes: ['Code graph:'],
        changedFiles: ['src/index.ts'],
        verificationSuccess: true,
      },
    });

    expect(result.success).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'model input includes: Code graph:', success: false }),
        expect.objectContaining({ name: 'changed file: src/index.ts', success: false }),
        expect.objectContaining({ name: 'verification success', success: false }),
      ])
    );
  });

  it('should convert runner errors into failed task results', async () => {
    const service = new MiniHarnessService(
      async () => {
        throw new Error('model unavailable');
      },
      {
        workspaceRoot,
        keepWorkspaces: false,
      }
    );

    const result = await service.runTask({
      id: 'runner-error',
      title: 'Runner error task',
      fixtureDir,
      userMessage: 'run failing task',
      expected: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('model unavailable');
    expect(result.checks).toEqual([
      expect.objectContaining({
        name: 'runner completed',
        success: false,
        actual: 'model unavailable',
      }),
    ]);
  });
});
