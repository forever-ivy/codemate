import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RepoMapService } from '../../../src/context/RepoMapService';

describe('RepoMapService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-repo-map-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src', 'agents'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'src', 'components'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'tests'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, '.hidden'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'node_modules', 'ignored'), { recursive: true });

    await fs.writeFile(path.join(fixtureDir, 'package.json'), '{"name":"fixture"}');
    await fs.writeFile(path.join(fixtureDir, 'tsconfig.json'), '{}');
    await fs.writeFile(path.join(fixtureDir, 'README.md'), '# Fixture');
    await fs.writeFile(path.join(fixtureDir, 'docs', 'guide.md'), '# Guide');
    await fs.writeFile(
      path.join(fixtureDir, 'src', 'agents', 'AgentLoop.ts'),
      [
        "import { Button } from '../components/Button';",
        '',
        'export class AgentLoop {',
        '  render(): string {',
        '    return Button;',
        '  }',
        '}',
      ].join('\n')
    );
    await fs.writeFile(
      path.join(fixtureDir, 'src', 'components', 'Button.tsx'),
      'export const Button = "button";'
    );
    await fs.writeFile(path.join(fixtureDir, 'tests', 'AgentLoop.test.ts'), 'test("x",()=>{})');
    await fs.writeFile(path.join(fixtureDir, '.hidden', 'secret.ts'), 'export {}');
    await fs.writeFile(path.join(fixtureDir, 'node_modules', 'ignored', 'index.js'), 'ignored');
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should build a compact repository map', () => {
    const service = new RepoMapService(fixtureDir);

    const repoMap = service.build();

    expect(repoMap.packageManager).toBe('npm');
    expect(repoMap.projectType).toEqual(['node', 'typescript', 'react']);
    expect(repoMap.importantFiles).toContain('package.json');
    expect(repoMap.importantFiles).toContain('tsconfig.json');
    expect(repoMap.importantFiles).toContain('README.md');
    expect(repoMap.sourceRoots).toEqual(['src', 'tests']);
    expect(repoMap.codeGraph.fileCount).toBeGreaterThan(0);
    expect(repoMap.codeGraph.edges).toContainEqual({
      from: 'src/agents/AgentLoop.ts',
      to: 'src/components/Button.tsx',
    });
    expect(repoMap.files.map((file) => file.path)).not.toContain('node_modules/ignored/index.js');
  });

  it('should build repository index metadata', () => {
    const service = new RepoMapService(fixtureDir);

    const repoMap = service.build();

    expect(repoMap.index.fileCount).toBe(repoMap.files.length);
    expect(repoMap.index.totalSize).toBeGreaterThan(0);
    expect(repoMap.index.byExtension['.ts']).toBeGreaterThan(0);
    expect(repoMap.index.byExtension['.tsx']).toBe(1);
    expect(repoMap.index.directories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src', fileCount: 2 }),
        expect.objectContaining({ path: 'tests', fileCount: 1 }),
      ])
    );
    expect(repoMap.index.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '.hidden', reason: 'hidden-path' }),
        expect.objectContaining({ path: 'node_modules', reason: 'ignored-dir' }),
      ])
    );
  });

  it('should select files that match the user request', () => {
    const service = new RepoMapService(fixtureDir, {
      maxSelectedFiles: 3,
    });

    const selected = service.selectForMessage('fix the AgentLoop tests');

    expect(selected.selectedFiles.map((file) => file.path)).toContain('src/agents/AgentLoop.ts');
    expect(selected.selectedFiles.map((file) => file.path)).toContain('tests/AgentLoop.test.ts');
    expect(selected.prompt).toContain('## Repository Context');
    expect(selected.prompt).toContain('Repository index:');
    expect(selected.prompt).toContain('Code graph:');
    expect(selected.prompt).toContain('Top extensions:');
    expect(selected.prompt).toContain('Likely relevant files:');
  });

  it('should use code graph symbols during context selection', () => {
    const service = new RepoMapService(fixtureDir, {
      maxSelectedFiles: 3,
    });

    const selected = service.selectForMessage('explain Button symbol');

    expect(selected.selectedFiles.map((file) => file.path)).toContain('src/components/Button.tsx');
    expect(selected.prompt).toContain('export const Button');
  });

  it('should include semantic index signals in prompts and selection', () => {
    const service = new RepoMapService(fixtureDir, {
      maxSelectedFiles: 3,
    });

    const selected = service.selectForMessage('where is Button referenced');

    expect(selected.repoMap.semanticIndex.symbols.map((symbol) => symbol.name)).toContain('Button');
    expect(selected.selectedFiles.map((file) => file.path)).toContain('src/components/Button.tsx');
    expect(selected.selectedFiles.map((file) => file.path)).toContain('src/agents/AgentLoop.ts');
    expect(selected.prompt).toContain('Semantic index:');
    expect(selected.prompt).toContain('- Symbols indexed:');
    expect(selected.prompt).toContain('src/components/Button.tsx');
  });

  it('should include git changed files in the repository prompt', () => {
    const service = new RepoMapService(
      fixtureDir,
      {
        cacheTtlMs: 0,
      },
      {
        getSnapshot: () => ({
          isGitRepository: true,
          changedFiles: [{ path: 'src/components/Button.tsx', status: 'modified' }],
        }),
      }
    );

    const selected = service.selectForMessage('what changed in this project');

    expect(selected.repoMap.gitDiff.changedFiles).toEqual([
      { path: 'src/components/Button.tsx', status: 'modified' },
    ]);
    expect(selected.prompt).toContain('Git changes:');
    expect(selected.prompt).toContain('- src/components/Button.tsx (modified)');
  });

  it('should prioritize git changed files during context selection', () => {
    const service = new RepoMapService(
      fixtureDir,
      {
        cacheTtlMs: 0,
        maxSelectedFiles: 2,
      },
      {
        getSnapshot: () => ({
          isGitRepository: true,
          changedFiles: [{ path: 'src/components/Button.tsx', status: 'modified' }],
        }),
      }
    );

    const selected = service.selectForMessage('please review my local changes');

    expect(selected.selectedFiles.map((file) => file.path)).toContain('src/components/Button.tsx');
  });

  it('should select verification issue files for repair context', () => {
    const service = new RepoMapService(
      fixtureDir,
      {
        cacheTtlMs: 0,
        maxSelectedFiles: 4,
      },
      {
        getSnapshot: () => ({
          isGitRepository: true,
          changedFiles: [],
        }),
      }
    );

    const selected = service.selectForVerificationIssues('fix failing tests', [
      {
        file: 'tests/AgentLoop.test.ts',
        line: 5,
        column: 13,
        message: 'expected true to be false',
        source: 'pnpm run test',
      },
    ]);

    expect(selected.selectedFiles.map((file) => file.path)).toContain('tests/AgentLoop.test.ts');
    expect(selected.prompt).toContain('Verification files:');
    expect(selected.prompt).toContain('- tests/AgentLoop.test.ts');
  });

  it('should reuse the cached repository map until invalidated', async () => {
    const service = new RepoMapService(fixtureDir, {
      cacheTtlMs: 60_000,
    });

    const first = service.build();
    await fs.writeFile(path.join(fixtureDir, 'src', 'NewFile.ts'), 'export {}');

    const cached = service.build();
    expect(cached).toBe(first);
    expect(cached.files.map((file) => file.path)).not.toContain('src/NewFile.ts');

    const refreshed = service.refresh();
    expect(refreshed).not.toBe(first);
    expect(refreshed.files.map((file) => file.path)).toContain('src/NewFile.ts');
  });

  it('should record paths skipped by the max depth guard', () => {
    const service = new RepoMapService(fixtureDir, {
      maxDepth: 0,
      cacheTtlMs: 0,
    });

    const repoMap = service.build();

    expect(repoMap.files.map((file) => file.path)).toContain('package.json');
    expect(repoMap.files.map((file) => file.path)).not.toContain('src/agents/AgentLoop.ts');
    expect(repoMap.index.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'src', reason: 'max-depth' })])
    );
  });
});
