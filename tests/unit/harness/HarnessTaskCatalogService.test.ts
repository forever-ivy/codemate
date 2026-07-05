import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HarnessTaskCatalogService } from '../../../src/harness/HarnessTaskCatalogService';

describe('HarnessTaskCatalogService', () => {
  const catalogPath = path.join(process.cwd(), 'tests', 'fixtures', 'harness', 'tasks.json');
  const tempRoot = path.join(process.cwd(), 'tmp-harness-task-catalog');

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('should load validated tasks and resolve fixture repositories', async () => {
    const service = new HarnessTaskCatalogService();

    const catalog = await service.load(catalogPath);

    expect(catalog.version).toBe(1);
    expect(catalog.tasks.map((task) => task.id)).toEqual(['fix-addition', 'add-multiply']);
    expect(catalog.tasks[0]).toMatchObject({
      category: 'bugfix',
      tags: ['javascript', 'unit-test'],
      verificationCommands: ['npm test'],
      expected: {
        changedFiles: ['src/math.js'],
        verificationSuccess: true,
      },
    });
    await expect(fs.access(catalog.tasks[0].fixtureDir)).resolves.toBeUndefined();
  });

  it('should reject duplicate task ids', async () => {
    const fixtureDir = await prepareFixture();
    const duplicateTask = createTask('duplicate', './fixture');
    const manifest = {
      version: 1,
      tasks: [duplicateTask, duplicateTask],
    };
    const manifestPath = await writeManifest(manifest);

    const service = new HarnessTaskCatalogService();

    await expect(service.load(manifestPath)).rejects.toThrow(
      'Duplicate harness task id: duplicate'
    );
    await expect(fs.access(fixtureDir)).resolves.toBeUndefined();
  });

  it('should reject fixture paths outside the catalog directory', async () => {
    await fs.mkdir(tempRoot, { recursive: true });
    const manifestPath = await writeManifest({
      version: 1,
      tasks: [createTask('outside-fixture', '../outside')],
    });

    const service = new HarnessTaskCatalogService();

    await expect(service.load(manifestPath)).rejects.toThrow(
      'Fixture path must stay inside the catalog directory'
    );
  });

  async function prepareFixture(): Promise<string> {
    const fixtureDir = path.join(tempRoot, 'fixture');
    await fs.mkdir(fixtureDir, { recursive: true });
    await fs.writeFile(path.join(fixtureDir, 'package.json'), '{}\n', 'utf-8');
    return fixtureDir;
  }

  async function writeManifest(manifest: unknown): Promise<string> {
    await fs.mkdir(tempRoot, { recursive: true });
    const manifestPath = path.join(tempRoot, 'tasks.json');
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
    return manifestPath;
  }

  function createTask(id: string, fixture: string): Record<string, unknown> {
    return {
      id,
      title: `Task ${id}`,
      category: 'bugfix',
      tags: ['test'],
      fixture,
      userMessage: 'Fix the task.',
      verificationCommands: ['npm test'],
      expected: {
        changedFiles: ['src/index.js'],
        verificationSuccess: true,
      },
    };
  }
});
