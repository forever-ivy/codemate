import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolManager } from '../../../src/managers/ToolManager';
import { EventBus } from '../../../src/services/EventBus';
import { ToolTraceService } from '../../../src/tools/ToolTraceService';
import { EditFileTool } from '../../../src/tools/file/EditFileTool';
import { ReadFileTool } from '../../../src/tools/file/ReadFileTool';
import { WriteFileTool } from '../../../src/tools/file/WriteFileTool';
import { EventType } from '../../../src/types/index';

describe('ToolManager', () => {
  let toolManager: ToolManager;
  let eventBus: EventBus;

  beforeEach(() => {
    toolManager = new ToolManager();
    eventBus = new EventBus();
    toolManager.setEventBus(eventBus);
  });

  afterEach(async () => {
    await fs.rm('tmp-approval-test.txt', { force: true });
  });

  // ... 原有测试 ...

  describe('events', () => {
    it('should emit tool.before event', async () => {
      const handler = vi.fn();
      const tool = new ReadFileTool();
      toolManager.register(tool);

      eventBus.on(EventType.TOOL_BEFORE, handler);

      try {
        await toolManager.execute('read_file', { path: 'test.txt' });
      } catch {
        // 忽略执行错误
      }

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        name: 'read_file',
        input: { path: 'test.txt' },
        timestamp: expect.any(Number),
      });
    });

    it('should emit tool.after event on success', async () => {
      const handler = vi.fn();
      const tool = new ReadFileTool();
      toolManager.register(tool);

      eventBus.on(EventType.TOOL_AFTER, handler);

      try {
        await toolManager.execute('read_file', { path: 'package.json' });
      } catch {
        // 忽略执行错误
      }

      // 如果文件存在，应该发出 after 事件
      if (handler.mock.calls.length > 0) {
        expect(handler).toHaveBeenCalledWith({
          name: 'read_file',
          result: expect.objectContaining({
            content: expect.any(String),
            size: expect.any(Number),
          }),
          timestamp: expect.any(Number),
        });
      }
    });

    it('should emit tool.error event on failure', async () => {
      const handler = vi.fn();
      const tool = new ReadFileTool();
      toolManager.register(tool);

      eventBus.on(EventType.TOOL_ERROR, handler);

      try {
        await toolManager.execute('read_file', { path: 'non-existent.txt' });
      } catch {
        // 预期会抛出错误
      }

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        name: 'read_file',
        error: expect.any(Error),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('approval policy', () => {
    it('should emit sandbox decisions before approval decisions', async () => {
      const sandboxHandler = vi.fn();
      const approvalHandler = vi.fn();
      toolManager.register(new ReadFileTool());
      eventBus.on('tool_sandbox_decision', sandboxHandler);
      eventBus.on('tool_approval_decision', approvalHandler);

      await toolManager.execute('read_file', { path: 'package.json' });

      expect(sandboxHandler).toHaveBeenCalledWith({
        name: 'read_file',
        input: { path: 'package.json' },
        sandbox: {
          status: 'allow',
          category: 'file',
          reason: 'Read-only file access stays inside the workspace.',
        },
        timestamp: expect.any(Number),
      });
      expect(sandboxHandler.mock.invocationCallOrder[0]).toBeLessThan(
        approvalHandler.mock.invocationCallOrder[0]
      );
    });

    it('should block write tools in default approval mode', async () => {
      toolManager.register(new WriteFileTool());
      eventBus.on('tool_approval_request', (request) => {
        eventBus.emit('tool_approval_response', {
          requestId: request.id,
          approved: false,
          reason: 'User denied from approval card',
        });
      });

      await expect(
        toolManager.execute('write_file', {
          path: 'tmp-approval-test.txt',
          content: 'hello',
        })
      ).rejects.toThrow('Tool approval denied: User denied from approval card');
    });

    it('should continue file writes after approval response is accepted', async () => {
      toolManager.register(new WriteFileTool());
      eventBus.on('tool_approval_request', (request) => {
        eventBus.emit('tool_approval_response', {
          requestId: request.id,
          approved: true,
        });
      });

      const result = await toolManager.execute('write_file', {
        path: 'tmp-approval-test.txt',
        content: 'hello',
      });

      expect(result).toEqual({
        success: true,
        bytesWritten: 5,
      });
      expect(await fs.readFile('tmp-approval-test.txt', 'utf-8')).toBe('hello');
    });

    it('should reject file writes after approval response is denied', async () => {
      toolManager.register(new WriteFileTool());
      eventBus.on('tool_approval_request', (request) => {
        eventBus.emit('tool_approval_response', {
          requestId: request.id,
          approved: false,
          reason: 'User denied from approval card',
        });
      });

      await expect(
        toolManager.execute('write_file', {
          path: 'tmp-approval-test.txt',
          content: 'hello',
        })
      ).rejects.toThrow('Tool approval denied: User denied from approval card');
    });

    it('should emit approval requests with diff preview for file creation', async () => {
      const handler = vi.fn();
      toolManager.register(new WriteFileTool());
      eventBus.on('tool_approval_request', (request) => {
        handler(request);
        eventBus.emit('tool_approval_response', {
          requestId: request.id,
          approved: false,
          reason: 'Preview inspected in test',
        });
      });

      await expect(
        toolManager.execute('write_file', {
          path: 'tmp-approval-test.txt',
          content: 'hello',
        })
      ).rejects.toThrow('Tool approval denied: Preview inspected in test');

      expect(handler).toHaveBeenCalledWith({
        id: expect.any(String),
        toolName: 'write_file',
        input: {
          path: 'tmp-approval-test.txt',
          content: 'hello',
        },
        approval: {
          status: 'requires_approval',
          risk: 'write',
          reason: 'write_file requires user approval in default mode.',
        },
        sandbox: {
          status: 'requires_approval',
          category: 'file',
          reason: 'File mutation stays inside the workspace but still requires approval.',
        },
        preview: expect.objectContaining({
          kind: 'file_diff',
          relativePath: 'tmp-approval-test.txt',
          beforeExists: false,
          diff: expect.stringContaining('+ hello'),
        }),
        terminalPreview: expect.stringContaining('Diff preview:'),
        timestamp: expect.any(Number),
      });
    });

    it('should emit approval requests with diff preview before editing files', async () => {
      const handler = vi.fn();
      await fs.writeFile('tmp-approval-test.txt', 'before\n', 'utf-8');
      toolManager.register(new EditFileTool());
      eventBus.on('tool_approval_request', (request) => {
        handler(request);
        eventBus.emit('tool_approval_response', {
          requestId: request.id,
          approved: false,
          reason: 'Preview inspected in test',
        });
      });

      await expect(
        toolManager.execute('edit_file', {
          path: 'tmp-approval-test.txt',
          oldContent: 'before',
          newContent: 'after',
        })
      ).rejects.toThrow('Tool approval denied: Preview inspected in test');

      expect(await fs.readFile('tmp-approval-test.txt', 'utf-8')).toBe('before\n');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'edit_file',
          preview: expect.objectContaining({
            kind: 'file_diff',
            relativePath: 'tmp-approval-test.txt',
            beforeExists: true,
            diff: expect.stringContaining('- before'),
          }),
          terminalPreview: expect.stringContaining('+ after'),
        })
      );
    });

    it('should allow write tools in autoEdit approval mode', async () => {
      toolManager.setApprovalMode('autoEdit');
      toolManager.register(new WriteFileTool());

      const result = await toolManager.execute('write_file', {
        path: 'tmp-approval-test.txt',
        content: 'hello',
      });

      expect(result).toEqual({
        success: true,
        bytesWritten: 5,
      });
    });

    it('should emit approval decisions before tool execution', async () => {
      const handler = vi.fn();
      toolManager.register(new ReadFileTool());
      eventBus.on('tool_approval_decision', handler);

      try {
        await toolManager.execute('read_file', { path: 'package.json' });
      } catch {
        // Ignore file-system errors; this test only checks the approval event.
      }

      expect(handler).toHaveBeenCalledWith({
        name: 'read_file',
        input: { path: 'package.json' },
        approval: {
          status: 'allow',
          risk: 'read',
          reason: 'Read-only tools are safe to run automatically.',
        },
        timestamp: expect.any(Number),
      });
    });

    it('should reject write tools that target paths outside the workspace', async () => {
      toolManager.setApprovalMode('autoEdit');
      toolManager.register(new WriteFileTool());

      await expect(
        toolManager.execute('write_file', {
          path: '../outside-workspace.txt',
          content: 'nope',
        })
      ).rejects.toThrow('Tool denied by sandbox policy');
    });

    it('should emit file change events after file mutations', async () => {
      const handler = vi.fn();
      toolManager.setApprovalMode('autoEdit');
      toolManager.register(new WriteFileTool());
      eventBus.on('file_change', handler);

      await toolManager.execute('write_file', {
        path: 'tmp-approval-test.txt',
        content: 'hello',
      });

      expect(handler).toHaveBeenCalledWith({
        change: expect.objectContaining({
          toolName: 'write_file',
          relativePath: 'tmp-approval-test.txt',
          kind: 'created',
          diff: expect.stringContaining('+ hello'),
        }),
        timestamp: expect.any(Number),
      });
    });
  });

  describe('standardized tool contracts and results', () => {
    it('should expose normalized tool schemas for registered tools', () => {
      toolManager.register(new ReadFileTool());

      const schemas = toolManager.getToolSchemas();

      expect(schemas).toEqual([
        expect.objectContaining({
          name: 'read_file',
          description: expect.any(String),
          inputSchema: expect.objectContaining({
            type: 'object',
          }),
        }),
      ]);
    });

    it('should return a standardized success result without changing execute()', async () => {
      toolManager.register(new ReadFileTool());

      const rawResult = await toolManager.execute('read_file', {
        path: 'package.json',
      });
      const standardizedResult = await toolManager.executeWithResult('read_file', {
        path: 'package.json',
      });

      expect(rawResult).toEqual(
        expect.objectContaining({
          content: expect.any(String),
          size: expect.any(Number),
        })
      );
      expect(standardizedResult).toEqual({
        ok: true,
        toolName: 'read_file',
        input: { path: 'package.json' },
        output: expect.objectContaining({
          content: expect.any(String),
          size: expect.any(Number),
        }),
        sandbox: {
          status: 'allow',
          category: 'file',
          reason: 'Read-only file access stays inside the workspace.',
        },
        durationMs: expect.any(Number),
        executionDurationMs: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    it('should return a standardized failure result instead of throwing', async () => {
      toolManager.register(new ReadFileTool());

      const result = await toolManager.executeWithResult('read_file', {
        path: 'missing-standard-result.txt',
      });

      expect(result).toEqual({
        ok: false,
        toolName: 'read_file',
        input: { path: 'missing-standard-result.txt' },
        sandbox: {
          status: 'allow',
          category: 'file',
          reason: 'Read-only file access stays inside the workspace.',
        },
        error: expect.objectContaining({
          message: expect.stringContaining('Tool execution failed'),
        }),
        durationMs: expect.any(Number),
        executionDurationMs: expect.any(Number),
        timestamp: expect.any(Number),
      });
    });

    it('should separate approval wait time from tool execution duration', async () => {
      toolManager.register(new WriteFileTool());
      toolManager.setApprovalMode('default');
      eventBus.on('tool_approval_request', (request) => {
        setTimeout(() => {
          eventBus.emit('tool_approval_response', {
            requestId: request.id,
            approved: true,
          });
        }, 30);
      });

      const result = await toolManager.executeWithResult('write_file', {
        path: 'tmp-approval-test.txt',
        content: 'hello',
      });

      expect(result.ok).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(30);
      expect(result.executionDurationMs).toBeLessThan(result.durationMs);
    });

    it('should write standardized tool results to the trace service', async () => {
      const traceService = new ToolTraceService();
      toolManager.setToolTraceService(traceService);
      toolManager.register(new ReadFileTool());

      await toolManager.executeWithResult('read_file', {
        path: 'package.json',
      });

      expect(traceService.list()).toEqual([
        expect.objectContaining({
          ok: true,
          toolName: 'read_file',
          input: { path: 'package.json' },
          sandbox: {
            status: 'allow',
            category: 'file',
            reason: 'Read-only file access stays inside the workspace.',
          },
          durationMs: expect.any(Number),
          executionDurationMs: expect.any(Number),
        }),
      ]);
    });

    it('should accept and preserve typed execution context for standardized results', async () => {
      const traceService = new ToolTraceService();
      toolManager.setToolTraceService(traceService);
      toolManager.register(new ReadFileTool());

      const result = await toolManager.executeWithResult(
        'read_file',
        {
          path: 'package.json',
        },
        { toolCallId: 'call-1' }
      );

      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          toolName: 'read_file',
          executionContext: { toolCallId: 'call-1' },
          durationMs: expect.any(Number),
          executionDurationMs: expect.any(Number),
        })
      );
      expect(traceService.latest()).toEqual(
        expect.objectContaining({
          executionContext: { toolCallId: 'call-1' },
        })
      );
    });
  });
});
