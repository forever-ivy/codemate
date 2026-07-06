import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileChangeTracker } from '../../../src/tools/FileChangeTracker';

describe('FileChangeTracker', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-file-change-fixture');
  const fixtureFile = path.join(fixtureDir, 'example.txt');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should report created files', async () => {
    const tracker = new FileChangeTracker();
    const snapshot = await tracker.captureBefore(
      'write_file',
      { path: path.relative(process.cwd(), fixtureFile) },
      process.cwd()
    );

    await fs.writeFile(fixtureFile, 'hello', 'utf-8');

    const change = await tracker.captureAfter(snapshot!);

    expect(change.kind).toBe('created');
    expect(change.diff).toContain('+ hello');
  });

  it('should report modified files', async () => {
    await fs.writeFile(fixtureFile, 'before', 'utf-8');

    const tracker = new FileChangeTracker();
    const snapshot = await tracker.captureBefore(
      'edit_file',
      { path: path.relative(process.cwd(), fixtureFile) },
      process.cwd()
    );

    await fs.writeFile(fixtureFile, 'after', 'utf-8');

    const change = await tracker.captureAfter(snapshot!);

    expect(change.kind).toBe('modified');
    expect(change.diff).toContain('- before');
    expect(change.diff).toContain('+ after');
  });

  it('should capture every file in an apply_patch call', async () => {
    const secondFile = path.join(fixtureDir, 'second.txt');
    await fs.writeFile(fixtureFile, 'before', 'utf-8');
    await fs.writeFile(secondFile, 'second', 'utf-8');
    const patch = [
      `--- a/${path.relative(process.cwd(), fixtureFile)}`,
      `+++ b/${path.relative(process.cwd(), fixtureFile)}`,
      '@@ -1 +1 @@',
      '-before',
      '+after',
      `--- a/${path.relative(process.cwd(), secondFile)}`,
      `+++ b/${path.relative(process.cwd(), secondFile)}`,
      '@@ -1 +1 @@',
      '-second',
      '+updated',
      '',
    ].join('\n');
    const tracker = new FileChangeTracker();

    const snapshots = await tracker.captureBeforeMany('apply_patch', { patch }, process.cwd());

    expect(snapshots.map((snapshot) => snapshot.relativePath)).toEqual([
      path.relative(process.cwd(), fixtureFile),
      path.relative(process.cwd(), secondFile),
    ]);
  });
});
