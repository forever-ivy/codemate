import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnifiedPatchService } from '../../../src/tools/patch/UnifiedPatchService';

describe('UnifiedPatchService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-unified-patch-fixture');
  const outsideDir = path.join(process.cwd(), 'tmp-unified-patch-outside');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.writeFile(
      path.join(fixtureDir, 'src/example.ts'),
      'export const value = 1;\n',
      'utf-8'
    );
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  });

  it('previews and applies a unified patch to an existing file', async () => {
    const service = new UnifiedPatchService(fixtureDir);
    const patch = [
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -1 +1 @@',
      '-export const value = 1;',
      '+export const value = 2;',
      '',
    ].join('\n');

    const preview = await service.preview(patch);

    expect(preview.files).toEqual([
      expect.objectContaining({
        path: 'src/example.ts',
        kind: 'modified',
        beforeContent: 'export const value = 1;\n',
        afterContent: 'export const value = 2;\n',
      }),
    ]);

    const result = await service.apply(patch);

    expect(result.files).toEqual([{ path: 'src/example.ts', kind: 'modified', bytesWritten: 24 }]);
    await expect(fs.readFile(path.join(fixtureDir, 'src/example.ts'), 'utf-8')).resolves.toBe(
      'export const value = 2;\n'
    );
  });

  it('creates a new file from a /dev/null patch', async () => {
    const service = new UnifiedPatchService(fixtureDir);
    const patch = [
      '--- /dev/null',
      '+++ b/src/created.ts',
      '@@ -0,0 +1 @@',
      '+export const created = true;',
      '',
    ].join('\n');

    const result = await service.apply(patch);

    expect(result.files[0]).toEqual({
      path: 'src/created.ts',
      kind: 'created',
      bytesWritten: 29,
    });
    await expect(fs.readFile(path.join(fixtureDir, 'src/created.ts'), 'utf-8')).resolves.toBe(
      'export const created = true;\n'
    );
  });

  it('does not write any file when one file fails preflight', async () => {
    await fs.writeFile(path.join(fixtureDir, 'src/second.ts'), 'export const second = 1;\n');
    const service = new UnifiedPatchService(fixtureDir);
    const patch = [
      '--- a/src/example.ts',
      '+++ b/src/example.ts',
      '@@ -1 +1 @@',
      '-export const value = 1;',
      '+export const value = 2;',
      '--- a/src/second.ts',
      '+++ b/src/second.ts',
      '@@ -1 +1 @@',
      '-content that does not exist',
      '+export const second = 2;',
      '',
    ].join('\n');

    await expect(service.apply(patch)).rejects.toThrow('does not apply cleanly');
    await expect(fs.readFile(path.join(fixtureDir, 'src/example.ts'), 'utf-8')).resolves.toBe(
      'export const value = 1;\n'
    );
    await expect(fs.readFile(path.join(fixtureDir, 'src/second.ts'), 'utf-8')).resolves.toBe(
      'export const second = 1;\n'
    );
  });

  it('rejects paths outside the workspace and protected directories', async () => {
    const service = new UnifiedPatchService(fixtureDir);

    await expect(
      service.preview('--- a/../outside.ts\n+++ b/../outside.ts\n@@ -0,0 +1 @@\n+bad\n')
    ).rejects.toThrow('outside the workspace');
    await expect(
      service.preview('--- a/.git/config\n+++ b/.git/config\n@@ -0,0 +1 @@\n+bad\n')
    ).rejects.toThrow('protected directory');
  });

  it('rejects empty and malformed patches', async () => {
    const service = new UnifiedPatchService(fixtureDir);

    await expect(service.preview('')).rejects.toThrow('Patch must not be empty');
    await expect(service.preview('not a unified diff')).rejects.toThrow('valid file changes');
  });

  it('rejects a workspace symlink that resolves outside the workspace', async () => {
    await fs.writeFile(path.join(outsideDir, 'outside.ts'), 'export const outside = 1;\n');
    await fs.symlink(path.join(outsideDir, 'outside.ts'), path.join(fixtureDir, 'src/link.ts'));
    const service = new UnifiedPatchService(fixtureDir);
    const patch = [
      '--- a/src/link.ts',
      '+++ b/src/link.ts',
      '@@ -1 +1 @@',
      '-export const outside = 1;',
      '+export const outside = 2;',
      '',
    ].join('\n');

    await expect(service.preview(patch)).rejects.toThrow('symbolic link outside the workspace');
  });
});
