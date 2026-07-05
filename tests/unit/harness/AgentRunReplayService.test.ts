import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentRunReplayService } from '../../../src/harness/AgentRunReplayService';
import type {
  MiniHarnessTask,
  MiniHarnessTaskResult,
} from '../../../src/harness/MiniHarnessService';
import type { ToolTraceRecord } from '../../../src/tools/ToolTraceService';

describe('AgentRunReplayService', () => {
  const storageDir = path.join(process.cwd(), 'tmp-agent-run-replays');

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it('should persist and load a versioned replay record', async () => {
    const service = createService();

    const record = await service.record(createTask(), createResult(), [createToolTrace()]);
    const loaded = await service.load(record.runId);

    expect(record.runId).toBe('replay-fix-addition-1000');
    expect(loaded).toEqual(record);
    expect(loaded).toMatchObject({
      version: 1,
      task: {
        id: 'fix-addition',
        userMessage: expect.stringContaining('Fix the add function'),
      },
      result: {
        success: true,
      },
    });
    await expect(fs.access(path.join(storageDir, `${record.runId}.json`))).resolves.toBeUndefined();
  });

  it('should replay recorded events in sequence without executing tools again', async () => {
    const service = createService();
    const record = await service.record(createTask(), createResult(), [createToolTrace()]);
    const handler = vi.fn();

    const summary = await service.replay(record.runId, handler);

    expect(summary).toEqual({
      runId: record.runId,
      taskId: 'fix-addition',
      success: true,
      eventCount: 7,
    });
    expect(handler.mock.calls.map(([event]) => event.type)).toEqual([
      'run_started',
      'model_input',
      'tool_result',
      'file_changes',
      'verification',
      'response',
      'run_completed',
    ]);
    expect(handler.mock.calls.map(([event]) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('should reject unsafe replay ids before reading files', async () => {
    const service = createService();

    await expect(service.load('../outside')).rejects.toThrow('Invalid replay id');
  });

  function createService(): AgentRunReplayService {
    return new AgentRunReplayService({
      storageDir,
      now: () => 1000,
      idFactory: (taskId, timestamp) => `replay-${taskId}-${timestamp}`,
    });
  }

  function createTask(): MiniHarnessTask {
    return {
      id: 'fix-addition',
      title: 'Fix addition',
      fixtureDir: '/fixtures/basic-js-repo',
      userMessage: 'Fix the add function and run npm test.',
      expected: {
        changedFiles: ['src/math.js'],
        verificationSuccess: true,
      },
    };
  }

  function createResult(): MiniHarnessTaskResult {
    return {
      taskId: 'fix-addition',
      title: 'Fix addition',
      success: true,
      workspaceDir: '/tmp/fix-addition',
      checks: [
        {
          name: 'verification success',
          success: true,
          expected: 'true',
          actual: 'true',
        },
      ],
      agentRun: {
        success: true,
        modelInput: 'Repository Context',
        responseContent: 'Fixed src/math.js and ran npm test.',
        changedFiles: ['src/math.js'],
        verification: {
          success: true,
          summary: 'npm test passed',
        },
      },
    };
  }

  function createToolTrace(): ToolTraceRecord {
    return {
      id: 'tool-trace-1',
      sequence: 1,
      ok: true,
      toolName: 'read_file',
      input: { path: 'src/math.js' },
      output: { content: 'export function add() {}' },
      durationMs: 5,
      timestamp: 1010,
      finishedAt: 1015,
    };
  }
});
