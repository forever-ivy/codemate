import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  VerificationService,
  type VerificationRunner,
} from '../../../src/verification/VerificationService';

describe('VerificationService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-verification-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(fixtureDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should discover package scripts in verification priority order', async () => {
    await fs.writeFile(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        scripts: {
          lint: 'eslint .',
          test: 'vitest run',
          typecheck: 'tsc --noEmit',
        },
      })
    );
    await fs.writeFile(path.join(fixtureDir, 'pnpm-lock.yaml'), '');

    const service = new VerificationService(fixtureDir);

    await expect(service.discoverCommands()).resolves.toEqual([
      { name: 'typecheck', command: 'pnpm run typecheck' },
      { name: 'test', command: 'pnpm run test' },
      { name: 'lint', command: 'pnpm run lint' },
    ]);
  });

  it('should run a bounded verification pass', async () => {
    await fs.writeFile(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
        },
      })
    );
    const runner: VerificationRunner = vi.fn(async (command) => ({
      exitCode: 0,
      stdout: `ran ${command}`,
      stderr: '',
    }));
    const service = new VerificationService(fixtureDir, { maxCommands: 1 }, runner);

    const result = await service.verify();

    expect(result.success).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('npm run typecheck');
    expect(result.summary).toContain('Verification passed');
  });

  it('should stop after the first failing command', async () => {
    await fs.writeFile(
      path.join(fixtureDir, 'package.json'),
      JSON.stringify({
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
        },
      })
    );
    const runner: VerificationRunner = vi.fn(async (command) => ({
      exitCode: command.includes('typecheck') ? 1 : 0,
      stdout: '',
      stderr: command.includes('typecheck') ? 'type error' : '',
    }));
    const service = new VerificationService(fixtureDir, {}, runner);

    const result = await service.verify();

    expect(result.success).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.summary).toContain('Verification failed');
    expect(result.summary).toContain('type error');
  });
});
