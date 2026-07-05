import * as fs from 'node:fs';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';

interface QuarantineEntry {
  file: string;
  reason: string;
  owner: string;
  expiresOn: string;
}

interface QuarantineManifest {
  version: number;
  entries: QuarantineEntry[];
}

describe('test quarantine manifest', () => {
  it('should keep every quarantined test explicit, owned and time bounded', () => {
    const manifestPath = path.resolve('config/test-quarantine.json');

    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as QuarantineManifest;
    const files = manifest.entries.map((entry) => entry.file);

    expect(manifest.version).toBe(1);
    expect(new Set(files).size).toBe(files.length);
    expect(manifest.entries.length).toBeGreaterThan(0);

    for (const entry of manifest.entries) {
      expect(entry.file).toMatch(/^tests\/.+\.test\.[cm]?[jt]sx?$/);
      expect(fs.existsSync(path.resolve(entry.file))).toBe(true);
      expect(entry.reason.trim().length).toBeGreaterThanOrEqual(20);
      expect(entry.owner.trim().length).toBeGreaterThan(0);
      expect(entry.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('should not quarantine the current coding-agent runtime and terminal UX regressions', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve('config/test-quarantine.json'), 'utf8')
    ) as QuarantineManifest;
    const files = new Set(manifest.entries.map((entry) => entry.file));

    expect(files.has('tests/unit/services/ModelService.test.ts')).toBe(false);
    expect(files.has('tests/unit/agents/AgentLoop.test.ts')).toBe(false);
    expect(files.has('tests/unit/ui/App.test.tsx')).toBe(false);
    expect(files.has('tests/unit/ui/AgentWorkbench.test.tsx')).toBe(false);
    expect(files.has('tests/unit/ui/CliUsabilityRegression.test.tsx')).toBe(false);
  });
});
