import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentRunReplayRecord } from '../../../src/harness/AgentRunReplayService';
import { GoldenTraceService } from '../../../src/harness/GoldenTraceService';

describe('GoldenTraceService', () => {
  const goldenDir = path.join(process.cwd(), 'tmp-golden-traces');

  afterEach(async () => {
    await fs.rm(goldenDir, { recursive: true, force: true });
  });

  it('should create, persist, and load a normalized golden trace', async () => {
    const service = new GoldenTraceService({ goldenDir });
    const trace = service.create(createReplayRecord());

    await service.save(trace);
    const loaded = await service.load('fix-addition');

    expect(loaded).toEqual(trace);
    expect(loaded.events).toEqual([
      { sequence: 1, type: 'run_started', data: { taskId: 'fix-addition' } },
      { sequence: 2, type: 'model_input', data: { present: true } },
      {
        sequence: 3,
        type: 'tool_result',
        data: { ok: true, toolName: 'read_file' },
      },
      {
        sequence: 4,
        type: 'file_changes',
        data: { files: ['src/math.js'] },
      },
      { sequence: 5, type: 'verification', data: { success: true } },
      { sequence: 6, type: 'response', data: { present: true } },
      { sequence: 7, type: 'run_completed', data: { success: true } },
    ]);
  });

  it('should pass when a replay matches the golden trace', () => {
    const service = new GoldenTraceService({ goldenDir });
    const replay = createReplayRecord();
    const golden = service.create(replay);

    const comparison = service.compare(replay, golden);

    expect(comparison).toEqual({
      taskId: 'fix-addition',
      success: true,
      mismatches: [],
    });
  });

  it('should report the exact event path when a replay regresses', () => {
    const service = new GoldenTraceService({ goldenDir });
    const baseline = createReplayRecord();
    const golden = service.create(baseline);
    const regressed = createReplayRecord();
    regressed.events[2] = {
      ...regressed.events[2],
      data: {
        ...asRecord(regressed.events[2].data),
        toolName: 'bash',
      },
    };

    const comparison = service.compare(regressed, golden);

    expect(comparison.success).toBe(false);
    expect(comparison.mismatches).toEqual([
      {
        path: 'events[2].data',
        expected: '{"ok":true,"toolName":"read_file"}',
        actual: '{"ok":true,"toolName":"bash"}',
      },
    ]);
  });

  function createReplayRecord(): AgentRunReplayRecord {
    return {
      version: 1,
      runId: 'replay-fix-addition-1000',
      createdAt: 1000,
      task: {
        id: 'fix-addition',
        title: 'Fix addition',
        userMessage: 'Fix the add function.',
        expected: {
          changedFiles: ['src/math.js'],
          verificationSuccess: true,
        },
      },
      result: {
        success: true,
        checks: [],
      },
      events: [
        {
          sequence: 1,
          type: 'run_started',
          timestamp: 1000,
          data: { taskId: 'fix-addition', title: 'Fix addition' },
        },
        {
          sequence: 2,
          type: 'model_input',
          timestamp: 1000,
          data: { content: 'Repository Context' },
        },
        {
          sequence: 3,
          type: 'tool_result',
          timestamp: 1010,
          data: {
            ok: true,
            toolName: 'read_file',
            durationMs: 5,
            output: { content: 'source' },
          },
        },
        {
          sequence: 4,
          type: 'file_changes',
          timestamp: 1020,
          data: { files: ['src/math.js'] },
        },
        {
          sequence: 5,
          type: 'verification',
          timestamp: 1030,
          data: { success: true, summary: 'npm test passed' },
        },
        {
          sequence: 6,
          type: 'response',
          timestamp: 1040,
          data: { content: 'Fixed the bug.' },
        },
        {
          sequence: 7,
          type: 'run_completed',
          timestamp: 1050,
          data: { success: true, checks: [] },
        },
      ],
    };
  }

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }
});
