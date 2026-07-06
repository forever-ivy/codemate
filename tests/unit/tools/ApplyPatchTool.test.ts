import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplyPatchTool } from '../../../src/tools/patch/ApplyPatchTool';

describe('ApplyPatchTool', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-apply-patch-tool-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(fixtureDir, 'src/value.ts'), 'export const value = 1;\n');
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('applies the submitted patch and returns structured file metadata', async () => {
    const tool = new ApplyPatchTool(fixtureDir);
    const patch = [
      '--- a/src/value.ts',
      '+++ b/src/value.ts',
      '@@ -1 +1 @@',
      '-export const value = 1;',
      '+export const value = 2;',
      '',
    ].join('\n');

    const result = await tool.execute({ patch });

    expect(result).toEqual({
      success: true,
      files: [{ path: 'src/value.ts', kind: 'modified', bytesWritten: 24 }],
    });
  });

  it('exposes a required patch string in its schema', () => {
    const tool = new ApplyPatchTool(fixtureDir);

    expect(() => tool.validate({})).toThrow('patch: Required');
    expect(tool.validate({ patch: '--- a/a\n+++ b/a\n@@ -0,0 +1 @@\n+x\n' })).toEqual({
      patch: '--- a/a\n+++ b/a\n@@ -0,0 +1 @@\n+x\n',
    });
  });
});
