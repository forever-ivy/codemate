import { describe, expect, it } from 'vitest';
import { ToolTraceService } from '../../../src/tools/ToolTraceService';

describe('ToolTraceService', () => {
  it('should record successful and failed tool results in order', () => {
    const service = new ToolTraceService();

    service.record({
      ok: true,
      toolName: 'read_file',
      input: { path: 'package.json' },
      output: { content: '{}', size: 2 },
      durationMs: 12,
      timestamp: 100,
    });
    service.record({
      ok: false,
      toolName: 'bash',
      input: { command: 'exit 1' },
      error: { name: 'Error', message: 'Command failed' },
      durationMs: 5,
      timestamp: 120,
    });

    expect(service.list()).toEqual([
      expect.objectContaining({
        id: 'tool-trace-1',
        sequence: 1,
        ok: true,
        toolName: 'read_file',
        finishedAt: 112,
      }),
      expect.objectContaining({
        id: 'tool-trace-2',
        sequence: 2,
        ok: false,
        toolName: 'bash',
        finishedAt: 125,
      }),
    ]);
  });

  it('should keep only the latest records when maxEntries is reached', () => {
    const service = new ToolTraceService({ maxEntries: 2 });

    for (const toolName of ['first', 'second', 'third']) {
      service.record({
        ok: true,
        toolName,
        input: {},
        output: {},
        durationMs: 1,
        timestamp: 100,
      });
    }

    expect(service.list().map((record) => record.toolName)).toEqual(['second', 'third']);
    expect(service.latest()?.toolName).toBe('third');
  });
});
