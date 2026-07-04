import { describe, expect, it } from 'vitest';
import { ContextReferenceService } from '../../../src/context/ContextReferenceService';

describe('ContextReferenceService', () => {
  it('should create references for included files and compressed summaries', () => {
    const service = new ContextReferenceService();

    const references = service.buildReferences(
      [
        {
          path: 'src/AgentLoop.ts',
          content: ['export class AgentLoop {', '  run() {}', '}'].join('\n'),
          bytesIncluded: 42,
        },
      ],
      [
        {
          path: 'src/LargeFile.ts',
          lineCount: 12,
        },
      ]
    );

    expect(references).toEqual([
      {
        id: 'ctx-1',
        kind: 'file-content',
        path: 'src/AgentLoop.ts',
        startLine: 1,
        endLine: 3,
        bytesIncluded: 42,
      },
      {
        id: 'ctx-2',
        kind: 'compressed-summary',
        path: 'src/LargeFile.ts',
        startLine: 1,
        endLine: 12,
      },
    ]);
  });

  it('should find references by kind and path', () => {
    const service = new ContextReferenceService({
      idPrefix: 'ref',
    });
    const references = service.buildReferences(
      [{ path: 'src/index.ts', content: 'export {}', bytesIncluded: 9 }],
      []
    );

    expect(service.findReference(references, 'file-content', 'src/index.ts')).toEqual(
      expect.objectContaining({
        id: 'ref-1',
      })
    );
    expect(service.findReference(references, 'compressed-summary', 'src/index.ts')).toBeUndefined();
  });
});
