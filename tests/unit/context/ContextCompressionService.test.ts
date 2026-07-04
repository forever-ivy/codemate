import { describe, expect, it } from 'vitest';
import { ContextCompressionService } from '../../../src/context/ContextCompressionService';

describe('ContextCompressionService', () => {
  it('should summarize truncated files with imports, symbols, and preview lines', () => {
    const service = new ContextCompressionService({
      maxImportLines: 2,
      maxSymbols: 3,
      maxPreviewLines: 2,
    });

    const summaries = service.buildSummaries([
      {
        path: 'src/service.ts',
        content: [
          "import { readFile } from 'node:fs/promises';",
          "import { join } from 'node:path';",
          "import { unused } from './unused';",
          'export interface ServiceOptions {',
          'export class Service {',
          'export function createService() {',
          'const value = 1;',
        ].join('\n'),
        estimatedTokens: 10,
        originalEstimatedTokens: 40,
        truncated: true,
      },
    ]);

    expect(summaries).toEqual([
      {
        path: 'src/service.ts',
        reason: 'truncated-file',
        lineCount: 7,
        estimatedTokens: 10,
        originalEstimatedTokens: 40,
        imports: [
          "import { readFile } from 'node:fs/promises';",
          "import { join } from 'node:path';",
        ],
        symbols: [
          'export interface ServiceOptions',
          'export class Service',
          'export function createService',
        ],
        preview: [
          "import { readFile } from 'node:fs/promises';",
          "import { join } from 'node:path';",
        ],
      },
    ]);
  });

  it('should ignore files that were not truncated', () => {
    const service = new ContextCompressionService();

    const summaries = service.buildSummaries([
      {
        path: 'src/small.ts',
        content: 'export const value = 1;',
        estimatedTokens: 5,
        originalEstimatedTokens: 5,
        truncated: false,
      },
    ]);

    expect(summaries).toEqual([]);
  });
});
