import { describe, expect, it, vi } from 'vitest';
import type { AgentLoopEvent, AgentLoopResult } from '../../../src/agents/AgentLoop';
import { HeadlessRunService } from '../../../src/headless/HeadlessRunService';
import { EventBus } from '../../../src/services/EventBus';

describe('HeadlessRunService', () => {
  it('writes one final JSON object and returns exit code 0 for completed runs', async () => {
    const writes: string[] = [];
    const service = new HeadlessRunService({
      agentLoop: {
        execute: vi.fn(async () => createResult({ success: true, status: 'completed' })),
      },
      eventBus: new EventBus(),
      write: (line) => writes.push(line),
    });

    const result = await service.run({
      message: 'add a menu',
      format: 'json',
    });

    expect(result.exitCode).toBe(0);
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0])).toMatchObject({
      schemaVersion: 1,
      runId: 'run-1',
      status: 'completed',
      success: true,
      changedFiles: ['src/App.tsx'],
    });
  });

  it('returns exit code 2 for incomplete coding-agent runs', async () => {
    const writes: string[] = [];
    const service = new HeadlessRunService({
      agentLoop: {
        execute: vi.fn(async () => createResult({ success: false, status: 'incomplete' })),
      },
      eventBus: new EventBus(),
      write: (line) => writes.push(line),
    });

    const result = await service.run({
      message: 'add a menu',
      format: 'json',
    });

    expect(result.exitCode).toBe(2);
    expect(JSON.parse(writes[0])).toMatchObject({
      status: 'incomplete',
      success: false,
    });
  });

  it('streams JSONL lifecycle events and final output for stream-json mode', async () => {
    const writes: string[] = [];
    const eventBus = new EventBus();
    const agentLoop = {
      execute: vi.fn(async () => {
        eventBus.emit('agent_loop_event', createAgentEvent());
        return createResult({ success: true, status: 'completed' });
      }),
    };
    const service = new HeadlessRunService({
      agentLoop,
      eventBus,
      write: (line) => writes.push(line),
      now: () => 123,
    });

    const result = await service.run({
      message: 'add a menu',
      format: 'stream-json',
    });

    expect(result.exitCode).toBe(0);
    expect(writes.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        type: 'run_started',
        message: 'add a menu',
        timestamp: 123,
      }),
      expect.objectContaining({
        schemaVersion: 1,
        type: 'agent_event',
        event: expect.objectContaining({
          phase: 'executing',
          description: 'Reading file: src/App.tsx',
        }),
      }),
      expect.objectContaining({
        schemaVersion: 1,
        type: 'run_completed',
        output: expect.objectContaining({
          runId: 'run-1',
          status: 'completed',
        }),
      }),
    ]);
  });

  it('cancels the active run and writes timeout output when timeout is reached', async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const agentLoop = {
      execute: vi.fn(() => new Promise<AgentLoopResult>(() => {})),
      cancelActiveRun: vi.fn(() => true),
    };
    const service = new HeadlessRunService({
      agentLoop,
      eventBus: new EventBus(),
      write: (line) => writes.push(line),
      now: () => 456,
    });

    const promise = service.run({
      message: 'long task',
      format: 'json',
      timeoutMs: 10,
    });

    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    vi.useRealTimers();

    expect(agentLoop.cancelActiveRun).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(124);
    expect(JSON.parse(writes[0])).toMatchObject({
      schemaVersion: 1,
      status: 'failed',
      success: false,
      error: 'Headless run timed out after 10ms.',
    });
  });
});

function createResult(input: {
  success: boolean;
  status: 'completed' | 'incomplete' | 'failed';
}): AgentLoopResult {
  return {
    runId: 'run-1',
    success: input.success,
    response: {
      content: 'Done',
      model: 'test-model',
    },
    structuredOutput: {
      schemaVersion: 1,
      runId: 'run-1',
      status: input.status,
      success: input.success,
      assistantMessage: 'Done',
      changedFiles: ['src/App.tsx'],
    },
  };
}

function createAgentEvent(): AgentLoopEvent {
  return {
    runId: 'run-1',
    phase: 'executing',
    description: 'Reading file: src/App.tsx',
    timestamp: 100,
    runtimeKind: 'tool',
    lifecycle: 'started',
  };
}
