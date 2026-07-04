import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContextBuilderService } from '../../../src/context/ContextBuilderService';
import type { SelectedContext } from '../../../src/context/RepoMapService';

describe('ContextBuilderService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-context-builder-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'assets'), { recursive: true });

    await fs.writeFile(
      path.join(fixtureDir, 'src', 'AgentLoop.ts'),
      'export const name = "agent";\n'
    );
    await fs.writeFile(path.join(fixtureDir, 'src', 'large.ts'), 'x'.repeat(120));
    await fs.writeFile(
      path.join(fixtureDir, 'src', 'summary.ts'),
      [
        "import { readFile } from 'node:fs/promises';",
        "import { join } from 'node:path';",
        '',
        'export interface SummaryOptions {',
        '  cwd: string;',
        '}',
        '',
        'export class SummaryService {',
        '  build(): string {',
        '    return join("a", "b");',
        '  }',
        '}',
      ].join('\n')
    );
    await fs.writeFile(path.join(fixtureDir, 'assets', 'logo.png'), 'not really png');
    await fs.writeFile(path.join(fixtureDir, 'src', 'binary.txt'), Buffer.from([0, 1, 2, 3]));
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should append selected text file contents to the repository prompt', () => {
    const service = new ContextBuilderService(fixtureDir);

    const context = service.build(
      createSelectedContext([{ path: 'src/AgentLoop.ts', ext: '.ts', size: 28 }])
    );

    expect(context.includedFiles).toEqual([
      expect.objectContaining({
        path: 'src/AgentLoop.ts',
        content: 'export const name = "agent";\n',
        truncated: false,
      }),
    ]);
    expect(context.prompt).toContain('## Repository Context');
    expect(context.prompt).toContain('Context budget:');
    expect(context.prompt).toContain('Context references:');
    expect(context.prompt).toContain('- [ctx-1] file-content: src/AgentLoop.ts lines 1-2');
    expect(context.prompt).toContain('Relevant file contents:');
    expect(context.prompt).toContain('### [ctx-1] src/AgentLoop.ts');
    expect(context.prompt).toContain('export const name = "agent";');
    expect(context.references).toEqual([
      expect.objectContaining({
        id: 'ctx-1',
        kind: 'file-content',
        path: 'src/AgentLoop.ts',
        startLine: 1,
        endLine: 2,
      }),
    ]);
    expect(context.budget.usedFileTokens).toBeGreaterThan(0);
  });

  it('should truncate large files by the per-file byte limit', () => {
    const service = new ContextBuilderService(fixtureDir, {
      maxBytesPerFile: 10,
      maxTotalBytes: 50,
    });

    const context = service.build(
      createSelectedContext([{ path: 'src/large.ts', ext: '.ts', size: 120 }])
    );

    expect(context.includedFiles[0]).toEqual(
      expect.objectContaining({
        path: 'src/large.ts',
        bytesIncluded: 10,
        originalEstimatedTokens: 3,
        truncated: true,
      })
    );
    expect(context.includedFiles[0].content).toHaveLength(10);
  });

  it('should truncate file contents by the token budget', () => {
    const service = new ContextBuilderService(fixtureDir, {
      maxBytesPerFile: 120,
      maxPromptTokens: 20,
      reservedResponseTokens: 5,
      charsPerToken: 4,
    });

    const context = service.build(
      createSelectedContext([{ path: 'src/large.ts', ext: '.ts', size: 120 }])
    );

    expect(context.includedFiles[0].estimatedTokens).toBeLessThan(
      context.includedFiles[0].originalEstimatedTokens
    );
    expect(context.includedFiles[0].truncated).toBe(true);
    expect(context.budget.truncatedFiles).toEqual(['src/large.ts']);
    expect(context.prompt).toContain('File content tokens:');
  });

  it('should add compressed summaries for truncated files', () => {
    const service = new ContextBuilderService(fixtureDir, {
      maxBytesPerFile: 220,
      maxPromptTokens: 60,
      reservedResponseTokens: 5,
      charsPerToken: 4,
      maxSummaryImportLines: 2,
      maxSummarySymbols: 2,
      maxSummaryPreviewLines: 2,
    });

    const context = service.build(
      createSelectedContext([{ path: 'src/summary.ts', ext: '.ts', size: 220 }])
    );

    expect(context.summaries).toEqual([
      expect.objectContaining({
        path: 'src/summary.ts',
        reason: 'truncated-file',
        imports: [
          "import { readFile } from 'node:fs/promises';",
          "import { join } from 'node:path';",
        ],
        symbols: ['export interface SummaryOptions', 'export class SummaryService'],
      }),
    ]);
    expect(context.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ctx-1',
          kind: 'file-content',
          path: 'src/summary.ts',
        }),
        expect.objectContaining({
          id: 'ctx-2',
          kind: 'compressed-summary',
          path: 'src/summary.ts',
        }),
      ])
    );
    expect(context.prompt).toContain('Compressed context summaries:');
    expect(context.prompt).toContain('### [ctx-2] src/summary.ts');
    expect(context.prompt).toContain(
      'Symbols: export interface SummaryOptions, export class SummaryService'
    );
  });

  it('should skip unsupported extensions and binary files', () => {
    const service = new ContextBuilderService(fixtureDir);

    const context = service.build(
      createSelectedContext([
        { path: 'assets/logo.png', ext: '.png', size: 14 },
        { path: 'src/binary.txt', ext: '.txt', size: 4 },
      ])
    );

    expect(context.includedFiles).toEqual([]);
    expect(context.skippedFiles).toEqual(
      expect.arrayContaining([
        { path: 'assets/logo.png', reason: 'unsupported-extension' },
        { path: 'src/binary.txt', reason: 'binary-file' },
      ])
    );
    expect(context.prompt).toContain('Skipped context files:');
  });

  it('should skip files outside the current working directory', () => {
    const service = new ContextBuilderService(fixtureDir);

    const context = service.build(
      createSelectedContext([{ path: '../outside.ts', ext: '.ts', size: 10 }])
    );

    expect(context.includedFiles).toEqual([]);
    expect(context.skippedFiles).toEqual([{ path: '../outside.ts', reason: 'path-outside-cwd' }]);
  });

  it('should stop loading files when the total byte budget is exhausted', () => {
    const service = new ContextBuilderService(fixtureDir, {
      maxBytesPerFile: 8,
      maxTotalBytes: 8,
    });

    const context = service.build(
      createSelectedContext([
        { path: 'src/AgentLoop.ts', ext: '.ts', size: 28 },
        { path: 'src/large.ts', ext: '.ts', size: 120 },
      ])
    );

    expect(context.includedFiles.map((file) => file.path)).toEqual(['src/AgentLoop.ts']);
    expect(context.skippedFiles).toEqual([{ path: 'src/large.ts', reason: 'budget-exhausted' }]);
  });
});

function createSelectedContext(selectedFiles: SelectedContext['selectedFiles']): SelectedContext {
  return {
    repoMap: {
      cwd: fixtureCwdForTypeOnly,
      generatedAt: Date.now(),
      projectType: ['typescript'],
      importantFiles: ['package.json'],
      sourceRoots: ['src'],
      files: selectedFiles,
      index: {
        generatedAt: Date.now(),
        fileCount: selectedFiles.length,
        totalSize: selectedFiles.reduce((sum, file) => sum + file.size, 0),
        byExtension: {},
        directories: [],
        skipped: [],
      },
      gitDiff: {
        isGitRepository: true,
        changedFiles: [],
      },
      codeGraph: createEmptyCodeGraph(),
    },
    selectedFiles,
    prompt: '## Repository Context\n- src',
  };
}

const fixtureCwdForTypeOnly = 'fixture';

function createEmptyCodeGraph() {
  return {
    generatedAt: Date.now(),
    fileCount: 0,
    files: [],
    edges: [],
    parseErrors: [],
  };
}
