import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CodeGraphService } from '../../../src/context/CodeGraphService';
import type { RepoMapFile } from '../../../src/context/RepoMapService';

describe('CodeGraphService', () => {
  const fixtureDir = path.join(process.cwd(), 'tmp-code-graph-fixture');

  beforeEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.mkdir(path.join(fixtureDir, 'src', 'utils'), { recursive: true });
    await fs.mkdir(path.join(fixtureDir, 'tests'), { recursive: true });

    await fs.writeFile(
      path.join(fixtureDir, 'src', 'utils', 'format.ts'),
      [
        'export interface FormatOptions {',
        '  upper?: boolean;',
        '}',
        '',
        'export function formatName(name: string): string {',
        '  return name.trim();',
        '}',
      ].join('\n')
    );
    await fs.writeFile(
      path.join(fixtureDir, 'src', 'AgentLoop.ts'),
      [
        "import { formatName } from './utils/format';",
        "const legacy = require('./utils/format');",
        '',
        'export class AgentLoop {',
        '  run(): string {',
        '    return formatName("agent");',
        '  }',
        '}',
        '',
        'export const createAgentLoop = () => new AgentLoop();',
      ].join('\n')
    );
    await fs.writeFile(path.join(fixtureDir, 'tests', 'AgentLoop.test.ts'), 'export {};');
    await fs.writeFile(path.join(fixtureDir, 'src', 'broken.ts'), 'export const = ;');
  });

  afterEach(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  });

  it('should extract imports, exports, symbols, and internal dependencies', () => {
    const service = new CodeGraphService(fixtureDir);
    const graph = service.build([
      createFile('src/AgentLoop.ts'),
      createFile('src/utils/format.ts'),
      createFile('tests/AgentLoop.test.ts'),
    ]);

    expect(graph.fileCount).toBe(3);
    expect(graph.edges).toContainEqual({
      from: 'src/AgentLoop.ts',
      to: 'src/utils/format.ts',
    });
    expect(graph.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/AgentLoop.ts',
          imports: expect.arrayContaining([
            expect.objectContaining({ source: './utils/format', kind: 'static' }),
            expect.objectContaining({ source: './utils/format', kind: 'require' }),
          ]),
          exports: expect.arrayContaining(['AgentLoop', 'createAgentLoop']),
          symbols: expect.arrayContaining([
            { name: 'AgentLoop', kind: 'class', exported: true },
            { name: 'createAgentLoop', kind: 'const', exported: true },
          ]),
          internalDependencies: ['src/utils/format.ts'],
        }),
      ])
    );
  });

  it('should record parse errors without failing the whole graph', () => {
    const service = new CodeGraphService(fixtureDir);
    const graph = service.build([createFile('src/broken.ts')]);

    expect(graph.fileCount).toBe(1);
    expect(graph.parseErrors).toEqual([
      expect.objectContaining({
        path: 'src/broken.ts',
      }),
    ]);
  });

  it('should ignore unsupported file extensions', async () => {
    await fs.writeFile(path.join(fixtureDir, 'README.md'), '# Docs');
    const service = new CodeGraphService(fixtureDir);
    const graph = service.build([createFile('README.md', '.md')]);

    expect(graph.fileCount).toBe(0);
    expect(graph.files).toEqual([]);
  });
});

function createFile(filePath: string, ext = path.extname(filePath)): RepoMapFile {
  return {
    path: filePath,
    ext,
    size: 500,
  };
}
