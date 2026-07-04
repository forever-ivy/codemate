import { describe, expect, it } from 'vitest';
import { SemanticIndexService } from '../../../src/context/SemanticIndexService';
import type { CodeGraph } from '../../../src/context/CodeGraphService';
import type { RepoMapFile } from '../../../src/context/RepoMapService';

describe('SemanticIndexService', () => {
  it('should build symbols, references, and diagnostics from a code graph', () => {
    const service = new SemanticIndexService();

    const index = service.build(files, codeGraph);

    expect(index.fileCount).toBe(3);
    expect(index.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'UserService',
          kind: 'class',
          path: 'src/UserService.ts',
          exported: true,
        }),
      ])
    );
    expect(index.references).toContainEqual({
      from: 'src/App.ts',
      to: 'src/UserService.ts',
      kind: 'import',
    });
    expect(index.diagnostics).toEqual([
      expect.objectContaining({
        path: 'src/Broken.ts',
        severity: 'error',
      }),
    ]);
  });

  it('should update one file without rebuilding unrelated entries', () => {
    const service = new SemanticIndexService();
    const index = service.build(files, codeGraph);

    const updated = service.updateFile(index, {
      path: 'src/UserService.ts',
      imports: [],
      exports: ['AccountService'],
      symbols: [{ name: 'AccountService', kind: 'class', exported: true }],
      internalDependencies: [],
    });

    expect(updated.fileCount).toBe(3);
    expect(updated.updatedFiles).toEqual(['src/UserService.ts']);
    expect(updated.symbols.map((symbol) => symbol.name)).toContain('AccountService');
    expect(updated.symbols.map((symbol) => symbol.name)).not.toContain('UserService');
    expect(updated.references).toContainEqual({
      from: 'src/App.ts',
      to: 'src/UserService.ts',
      kind: 'import',
    });
  });

  it('should query symbols and related files for natural-language requests', () => {
    const service = new SemanticIndexService();
    const index = service.build(files, codeGraph);

    const result = service.query(index, 'update UserService references');

    expect(result.matchedSymbols.map((symbol) => symbol.name)).toContain('UserService');
    expect(result.relatedFiles).toContain('src/UserService.ts');
    expect(result.relatedFiles).toContain('src/App.ts');
  });
});

const files: RepoMapFile[] = [
  { path: 'src/App.ts', ext: '.ts', size: 100 },
  { path: 'src/UserService.ts', ext: '.ts', size: 100 },
  { path: 'src/Broken.ts', ext: '.ts', size: 100 },
];

const codeGraph: CodeGraph = {
  generatedAt: 1,
  fileCount: 3,
  files: [
    {
      path: 'src/App.ts',
      imports: [{ source: './UserService', imported: ['UserService'], kind: 'static' }],
      exports: [],
      symbols: [{ name: 'App', kind: 'function', exported: true }],
      internalDependencies: ['src/UserService.ts'],
    },
    {
      path: 'src/UserService.ts',
      imports: [],
      exports: ['UserService'],
      symbols: [{ name: 'UserService', kind: 'class', exported: true }],
      internalDependencies: [],
    },
    {
      path: 'src/Broken.ts',
      imports: [],
      exports: [],
      symbols: [],
      internalDependencies: [],
      parseError: 'Unexpected token',
    },
  ],
  edges: [{ from: 'src/App.ts', to: 'src/UserService.ts' }],
  parseErrors: [{ path: 'src/Broken.ts', error: 'Unexpected token' }],
};
