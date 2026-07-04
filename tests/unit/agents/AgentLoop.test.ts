import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AgentLoop, type AgentLoopEvent } from '../../../src/agents/AgentLoop';
import { ToolManager } from '../../../src/managers/ToolManager';
import { EventBus } from '../../../src/services/EventBus';
import { Tool } from '../../../src/tools/base/Tool';

class EchoTool extends Tool<{ text: string }, { text: string }> {
  name = 'echo';
  description = 'Echo input text';
  schema = z.object({
    text: z.string(),
  });

  async execute(input: { text: string }): Promise<{ text: string }> {
    return input;
  }
}

function expectChatOptions() {
  return expect.objectContaining({
    runId: expect.any(String),
    onRuntimeEvent: expect.any(Function),
  });
}

describe('AgentLoop', () => {
  let toolManager: ToolManager;
  let eventBus: EventBus;
  let messages: Array<{ role: string; content: string }>;
  let sessionService: { addMessage: ReturnType<typeof vi.fn> };
  let fileHistory: { createSnapshot: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toolManager = new ToolManager();
    toolManager.register(new EchoTool());
    eventBus = new EventBus();
    messages = [];
    sessionService = {
      addMessage: vi.fn(async (message: { role: string; content: string }) => {
        messages.push(message);
      }),
    };
    fileHistory = {
      createSnapshot: vi.fn(async () => ({
        id: 'snapshot-1',
        messageId: 'agent-run-1',
        timestamp: new Date(),
        files: [],
      })),
    };
  });

  it('should execute a successful agent run through the model and tool manager', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done',
        model: 'test-model',
      })),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      fileHistory,
    });

    const result = await loop.execute('do work');

    expect(result.success).toBe(true);
    expect(result.structuredOutput).toMatchObject({
      schemaVersion: 1,
      status: 'completed',
      success: true,
      assistantMessage: 'Done',
      changedFiles: [],
    });
    expect(messages).toEqual([
      { role: 'user', content: 'do work' },
      { role: 'assistant', content: 'Done' },
    ]);
    expect(fileHistory.createSnapshot).toHaveBeenCalledOnce();
    expect(modelService.chatWithTools).toHaveBeenCalledWith(
      'do work',
      [expect.objectContaining({ name: 'echo' })],
      toolManager,
      expectChatOptions()
    );
    expect(events.map((event) => event.phase)).toEqual([
      'received',
      'intent',
      'snapshot',
      'planning',
      'executing',
      'responding',
      'completed',
    ]);
  });

  it('should surface runtime tool events through agent loop events', async () => {
    const modelService = {
      chatWithTools: vi.fn(async (_message, _tools, _manager, options) => {
        options.onRuntimeEvent({
          runId: 'run-1',
          turnId: 'turn-1',
          stepId: 'step-1',
          operationId: 'run-1:tool:1:read_file',
          kind: 'tool',
          lifecycle: 'started',
          type: 'tool_started',
          description: 'Reading file: src/App.tsx',
          timestamp: 1,
          toolName: 'read_file',
          toolCallId: 'run-1:tool:1:read_file',
        });
        options.onRuntimeEvent({
          runId: 'run-1',
          turnId: 'turn-1',
          stepId: 'step-1',
          operationId: 'call-1',
          kind: 'tool',
          lifecycle: 'completed',
          type: 'tool_completed',
          description: 'Reading file completed',
          timestamp: 2,
          toolName: 'read_file',
          toolCallId: 'call-1',
          durationMs: 120,
        });
        return {
          content: 'Done',
          model: 'test-model',
        };
      }),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
    });

    await loop.execute('change src/App.tsx');

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: 'executing',
          description: 'Reading file: src/App.tsx',
        }),
        expect.objectContaining({
          phase: 'executing',
          runtimeKind: 'tool',
          turnId: 'turn-1',
          stepId: 'step-1',
          toolCallId: 'call-1',
          operationId: 'call-1',
          lifecycle: 'completed',
          durationMs: 120,
          description: 'Reading file completed',
        }),
      ])
    );
  });

  it('forwards explicit runtime kind without deriving it from the operation id', async () => {
    const modelService = {
      chatWithTools: vi.fn(async (_message, _tools, _manager, options) => {
        options.onRuntimeEvent({
          runId: 'run-1',
          turnId: 'turn-1',
          stepId: 'step-1',
          operationId: 'call-1',
          kind: 'tool',
          lifecycle: 'started',
          type: 'tool_started',
          description: 'Listing files',
          timestamp: 1,
          toolName: 'list_files',
          toolCallId: 'call-1',
        });
        return {
          content: 'done',
          model: 'test-model',
        };
      }),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
    });

    await loop.execute('inspect files');

    expect(events).toContainEqual(
      expect.objectContaining({
        runtimeKind: 'tool',
        turnId: 'turn-1',
        stepId: 'step-1',
        toolCallId: 'call-1',
        operationId: 'call-1',
        description: 'Listing files',
      })
    );
  });

  it('should keep failed tool runtime events in the executing phase', async () => {
    const operationId = 'run-1:tool:1:read_file';
    const modelService = {
      chatWithTools: vi.fn(async (_message, _tools, _manager, options) => {
        options.onRuntimeEvent({
          runId: 'run-1',
          turnId: 'turn-1',
          stepId: 'step-1',
          operationId,
          kind: 'tool',
          lifecycle: 'started',
          type: 'tool_started',
          description: 'Reading file: missing.ts',
          timestamp: 1,
          toolName: 'read_file',
          toolCallId: operationId,
        });
        options.onRuntimeEvent({
          runId: 'run-1',
          turnId: 'turn-1',
          stepId: 'step-1',
          operationId,
          kind: 'tool',
          lifecycle: 'failed',
          type: 'tool_failed',
          description: 'Reading file failed',
          timestamp: 2,
          toolName: 'read_file',
          toolCallId: operationId,
          error: 'File not found',
        });
        return {
          content: 'Could not read the file',
          model: 'test-model',
        };
      }),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
    });

    await loop.execute('read missing.ts');

    const toolEvents = events.filter((event) => event.operationId === operationId);
    expect(toolEvents).toEqual([
      expect.objectContaining({
        phase: 'executing',
        lifecycle: 'started',
      }),
      expect.objectContaining({
        phase: 'executing',
        lifecycle: 'failed',
        error: 'File not found',
      }),
    ]);
  });

  it('aborts the active run through the model abort signal', async () => {
    let capturedAbortSignal: AbortSignal | undefined;
    const modelService = {
      chatWithTools: vi.fn(
        async (_message, _tools, _manager, options) =>
          new Promise<{ content: string; model: string }>((_resolve, reject) => {
            capturedAbortSignal = options.abortSignal;
            options.abortSignal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true }
            );
          })
      ),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
    });

    const executionPromise = loop.execute('inspect files');

    await vi.waitFor(() => {
      expect(capturedAbortSignal).toBeDefined();
    });

    expect(capturedAbortSignal?.aborted).toBe(false);
    expect(loop.cancelActiveRun()).toBe(true);
    expect(capturedAbortSignal?.aborted).toBe(true);

    const result = await executionPromise;

    expect(result).toMatchObject({
      success: false,
      error: 'The operation was aborted.',
    });
    expect(loop.cancelActiveRun()).toBe(false);
  });

  it('should mark code-change runs incomplete when the model changes no files', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'I added the requested menu.',
        model: 'test-model',
      })),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
    });

    const result = await loop.execute('add an orders menu to the admin dashboard');

    expect(result.success).toBe(false);
    expect(result.intent).toMatchObject({
      intent: 'code-change',
      requiresFileChange: true,
      requiresVerification: true,
    });
    expect(result.completion?.reasons).toContain(
      'Expected file changes, but no files were changed.'
    );
    expect(result.response?.content).toContain('Changed files: none');
    expect(result.response?.content).toContain('Completion incomplete:');
    expect(result.structuredOutput).toMatchObject({
      status: 'incomplete',
      success: false,
      intent: {
        intent: 'code-change',
        requiresFileChange: true,
      },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phase: 'intent',
          description: 'Classified run intent: code-change',
        }),
        expect.objectContaining({
          phase: 'incomplete',
          error: 'Expected file changes, but no files were changed.',
        }),
      ])
    );
  });

  it('should save an assistant error message when the model run fails', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => {
        throw new Error('model failed');
      }),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      fileHistory,
    });

    const result = await loop.execute('do risky work');

    expect(result).toMatchObject({
      runId: expect.any(String),
      success: false,
      error: 'model failed',
      structuredOutput: {
        schemaVersion: 1,
        status: 'failed',
        success: false,
        error: 'model failed',
      },
    });
    expect(messages).toEqual([
      { role: 'user', content: 'do risky work' },
      { role: 'assistant', content: '❌ Error: model failed' },
    ]);
    expect(events.at(-1)).toEqual({
      runId: expect.any(String),
      phase: 'failed',
      description: 'Agent run failed',
      timestamp: expect.any(Number),
      error: 'model failed',
    });
  });

  it('should inject selected repository context into the model message', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with context',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src/agents/AgentLoop.ts',
      })),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
    });

    await loop.execute('fix AgentLoop');

    expect(repoMapService.selectForMessage).toHaveBeenCalledWith('fix AgentLoop');
    expect(modelService.chatWithTools).toHaveBeenCalledWith(
      expect.stringContaining('## Repository Context\n- src/agents/AgentLoop.ts'),
      [expect.objectContaining({ name: 'echo' })],
      toolManager,
      expectChatOptions()
    );
    expect(modelService.chatWithTools).toHaveBeenCalledWith(
      expect.stringContaining('## Agent Run Contract'),
      [expect.objectContaining({ name: 'echo' })],
      toolManager,
      expectChatOptions()
    );
    expect(events.map((event) => event.phase)).toContain('context');
  });

  it('should enrich selected repository context with file contents before model call', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with file contents',
        model: 'test-model',
      })),
    };
    const selectedContext = {
      repoMap: {
        cwd: process.cwd(),
        generatedAt: Date.now(),
        projectType: ['typescript'],
        importantFiles: ['package.json'],
        sourceRoots: ['src'],
        files: [],
        index: {
          generatedAt: Date.now(),
          fileCount: 0,
          totalSize: 0,
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
      selectedFiles: [{ path: 'src/agents/AgentLoop.ts', ext: '.ts', size: 10 }],
      prompt: '## Repository Context\nLikely relevant files:\n- src/agents/AgentLoop.ts',
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => selectedContext),
    };
    const contextBuilderService = {
      build: vi.fn(() => ({
        ...selectedContext,
        includedFiles: [
          {
            path: 'src/agents/AgentLoop.ts',
            content: 'export class AgentLoop {}',
            size: 25,
            bytesIncluded: 25,
            truncated: false,
          },
        ],
        skippedFiles: [],
        prompt:
          '## Repository Context\nLikely relevant files:\n- src/agents/AgentLoop.ts\n\nRelevant file contents:\n### src/agents/AgentLoop.ts\n```\nexport class AgentLoop {}\n```',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      contextBuilderService,
    });

    await loop.execute('explain AgentLoop');

    expect(repoMapService.selectForMessage).toHaveBeenCalledWith('explain AgentLoop');
    expect(contextBuilderService.build).toHaveBeenCalledWith(selectedContext);
    expect(modelService.chatWithTools).toHaveBeenCalledWith(
      expect.stringContaining('Relevant file contents:'),
      [expect.objectContaining({ name: 'echo' })],
      toolManager,
      expectChatOptions()
    );
    expect(modelService.chatWithTools).toHaveBeenCalledWith(
      expect.stringContaining('export class AgentLoop {}'),
      [expect.objectContaining({ name: 'echo' })],
      toolManager,
      expectChatOptions()
    );
  });

  it('should inject compact session memory before repository context', async () => {
    messages = [
      { role: 'user', content: 'previous request' },
      { role: 'assistant', content: 'previous answer' },
    ];
    sessionService = {
      ...sessionService,
      getMessages: vi.fn(() => [...messages]),
    };
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with memory',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src',
      })),
    };
    const sessionMemoryService = {
      build: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [{ turn: 1, user: 'previous request', assistant: 'previous answer' }],
        prompt:
          '## Session Memory\n\nRecent turns: 1\n- Turn 1 user: previous request\n  assistant: previous answer',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      sessionMemoryService,
    });

    await loop.execute('continue the task');

    expect(sessionMemoryService.build).toHaveBeenCalledWith([
      { role: 'user', content: 'previous request' },
      { role: 'assistant', content: 'previous answer' },
    ]);
    expect(modelService.chatWithTools.mock.calls[0][0]).toContain('## Session Memory');
    expect(modelService.chatWithTools.mock.calls[0][0]).toContain('## Repository Context');
    expect(modelService.chatWithTools.mock.calls[0][0]).toContain(
      'User request:\ncontinue the task'
    );
    expect(messages.at(-2)).toEqual({ role: 'user', content: 'continue the task' });
  });

  it('should inject project memory before session memory and repository context', async () => {
    messages = [
      { role: 'user', content: 'previous task' },
      { role: 'assistant', content: 'previous result' },
    ];
    sessionService = {
      ...sessionService,
      getMessages: vi.fn(() => [...messages]),
    };
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with project memory',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src',
      })),
    };
    const sessionMemoryService = {
      build: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [{ turn: 1, user: 'previous task', assistant: 'previous result' }],
        prompt:
          '## Session Memory\n\nRecent turns: 1\n- Turn 1 user: previous task\n  assistant: previous result',
      })),
    };
    const projectMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: '.aicli/memory/project-memory.json',
        entryCount: 1,
        entries: [
          {
            id: 'pm-1',
            kind: 'convention',
            content: '教程代码和文档必须保持一致。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt:
          '## Project Memory\n\nStored entries: 1\n- convention: 教程代码和文档必须保持一致。',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      sessionMemoryService,
      projectMemoryService,
    });

    await loop.execute('continue with the next chapter');

    const modelMessage = modelService.chatWithTools.mock.calls[0][0];
    expect(projectMemoryService.build).toHaveBeenCalledOnce();
    expect(modelMessage).toContain('## Project Memory');
    expect(modelMessage).toContain('## Session Memory');
    expect(modelMessage).toContain('## Repository Context');
    expect(modelMessage.indexOf('## Project Memory')).toBeLessThan(
      modelMessage.indexOf('## Session Memory')
    );
    expect(modelMessage.indexOf('## Session Memory')).toBeLessThan(
      modelMessage.indexOf('## Repository Context')
    );
  });

  it('should inject hierarchical project instructions before project memory', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with project instructions',
        model: 'test-model',
      })),
    };
    const projectInstructionService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        entries: [
          {
            scope: 'repository',
            path: 'AGENTS.md',
            content: 'Run quality:release before committing.',
            priority: 10,
            truncated: false,
          },
        ],
        prompt:
          '## Project Instructions\n\nPriority: later entries override earlier project instruction entries.\n\n### repository: AGENTS.md\nRun quality:release before committing.',
      })),
    };
    const projectMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: '.aicli/memory/project-memory.json',
        entryCount: 1,
        entries: [
          {
            id: 'pm-1',
            kind: 'convention',
            content: '教程代码和文档必须保持一致。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt:
          '## Project Memory\n\nStored entries: 1\n- convention: 教程代码和文档必须保持一致。',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      projectInstructionService,
      projectMemoryService,
    });

    await loop.execute('continue with project rules');

    const modelMessage = modelService.chatWithTools.mock.calls[0][0];
    expect(projectInstructionService.build).toHaveBeenCalledOnce();
    expect(modelMessage).toContain('## Project Instructions');
    expect(modelMessage).toContain('### repository: AGENTS.md');
    expect(modelMessage).toContain('Run quality:release before committing.');
    expect(modelMessage).toContain('## Project Memory');
    expect(modelMessage.indexOf('## Project Instructions')).toBeLessThan(
      modelMessage.indexOf('## Project Memory')
    );
  });

  it('should inject user preferences before other memory and repository context', async () => {
    messages = [
      { role: 'user', content: 'previous task' },
      { role: 'assistant', content: 'previous result' },
    ];
    sessionService = {
      ...sessionService,
      getMessages: vi.fn(() => [...messages]),
    };
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with user preferences',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src',
      })),
    };
    const userPreferenceMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: 'memory/user-preferences.json',
        entryCount: 1,
        entries: [
          {
            id: 'up-1',
            category: 'communication',
            content: '用户偏好中文沟通。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt: '## User Preferences\n\nStored preferences: 1\n- communication: 用户偏好中文沟通。',
      })),
    };
    const projectMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: '.aicli/memory/project-memory.json',
        entryCount: 1,
        entries: [
          {
            id: 'pm-1',
            kind: 'convention',
            content: '教程代码和文档必须保持一致。',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt:
          '## Project Memory\n\nStored entries: 1\n- convention: 教程代码和文档必须保持一致。',
      })),
    };
    const sessionMemoryService = {
      build: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [{ turn: 1, user: 'previous task', assistant: 'previous result' }],
        prompt:
          '## Session Memory\n\nRecent turns: 1\n- Turn 1 user: previous task\n  assistant: previous result',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      userPreferenceMemoryService,
      projectMemoryService,
      sessionMemoryService,
    });

    await loop.execute('continue with user preferences');

    const modelMessage = modelService.chatWithTools.mock.calls[0][0];
    expect(userPreferenceMemoryService.build).toHaveBeenCalledOnce();
    expect(modelMessage).toContain('## User Preferences');
    expect(modelMessage).toContain('## Project Memory');
    expect(modelMessage).toContain('## Session Memory');
    expect(modelMessage).toContain('## Repository Context');
    expect(modelMessage.indexOf('## User Preferences')).toBeLessThan(
      modelMessage.indexOf('## Project Memory')
    );
    expect(modelMessage.indexOf('## Project Memory')).toBeLessThan(
      modelMessage.indexOf('## Session Memory')
    );
    expect(modelMessage.indexOf('## Session Memory')).toBeLessThan(
      modelMessage.indexOf('## Repository Context')
    );
  });

  it('should inject retrieved memory instead of full long-term memory when retrieval is available', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with retrieved memory',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src',
      })),
    };
    const userPreferenceMemory = {
      generatedAt: Date.now(),
      filePath: 'memory/user-preferences.json',
      entryCount: 1,
      entries: [
        {
          id: 'up-verify',
          category: 'workflow',
          content: '每章完成后先运行验证。',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      prompt: '## User Preferences\n\nStored preferences: 1\n- workflow: 每章完成后先运行验证。',
    };
    const projectMemory = {
      generatedAt: Date.now(),
      filePath: '.aicli/memory/project-memory.json',
      entryCount: 1,
      entries: [
        {
          id: 'pm-docs',
          kind: 'convention',
          content: '教程代码和文档必须保持一致。',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      prompt: '## Project Memory\n\nStored entries: 1\n- convention: 教程代码和文档必须保持一致。',
    };
    const userPreferenceMemoryService = {
      build: vi.fn(async () => userPreferenceMemory),
    };
    const projectMemoryService = {
      build: vi.fn(async () => projectMemory),
    };
    const projectInstructionService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        entries: [
          {
            scope: 'repository',
            path: 'AGENTS.md',
            content: 'Always keep tutorial docs and code in sync.',
            priority: 10,
            truncated: false,
          },
        ],
        prompt:
          '## Project Instructions\n\nPriority: later entries override earlier project instruction entries.\n\n### repository: AGENTS.md\nAlways keep tutorial docs and code in sync.',
      })),
    };
    const memoryRetrievalService = {
      build: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [
          {
            id: 'up-verify',
            source: 'user-preference',
            label: 'workflow',
            content: '每章完成后先运行验证。',
            score: 3,
          },
        ],
        prompt:
          '## Retrieved Memory\n\nMatched entries: 1\n- user-preference/workflow: 每章完成后先运行验证。',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      userPreferenceMemoryService,
      projectInstructionService,
      projectMemoryService,
      memoryRetrievalService,
    });

    await loop.execute('提交前先运行验证');

    const modelMessage = modelService.chatWithTools.mock.calls[0][0];
    expect(memoryRetrievalService.build).toHaveBeenCalledWith({
      userMessage: '提交前先运行验证',
      userPreferences: userPreferenceMemory,
      projectMemory,
    });
    expect(modelMessage).toContain('## Retrieved Memory');
    expect(modelMessage).toContain('## Project Instructions');
    expect(modelMessage).not.toContain('## User Preferences');
    expect(modelMessage).not.toContain('## Project Memory');
    expect(modelMessage.indexOf('## Retrieved Memory')).toBeLessThan(
      modelMessage.indexOf('## Project Instructions')
    );
    expect(modelMessage.indexOf('## Project Instructions')).toBeLessThan(
      modelMessage.indexOf('## Repository Context')
    );
  });

  it('should apply memory governance before injecting retrieved memory', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => ({
        content: 'Done with governed memory',
        model: 'test-model',
      })),
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => ({
        repoMap: {
          cwd: process.cwd(),
          generatedAt: Date.now(),
          projectType: ['typescript'],
          importantFiles: ['package.json'],
          sourceRoots: ['src'],
          files: [],
          index: {
            generatedAt: Date.now(),
            fileCount: 0,
            totalSize: 0,
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
        selectedFiles: [],
        prompt: '## Repository Context\n- src',
      })),
    };
    const userPreferenceMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: 'memory/user-preferences.json',
        entryCount: 0,
        entries: [],
        prompt: '',
      })),
    };
    const projectMemoryService = {
      build: vi.fn(async () => ({
        generatedAt: Date.now(),
        filePath: '.aicli/memory/project-memory.json',
        entryCount: 1,
        entries: [
          {
            id: 'pm-secret',
            kind: 'warning',
            content: 'Never commit OPENAI_API_KEY=sk-1234567890abcdef.',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        prompt:
          '## Project Memory\n\nStored entries: 1\n- warning: Never commit OPENAI_API_KEY=sk-1234567890abcdef.',
      })),
    };
    const retrievedEntry = {
      id: 'pm-secret',
      source: 'project',
      label: 'warning',
      content: 'Never commit OPENAI_API_KEY=sk-1234567890abcdef.',
      score: 10,
      updatedAt: 1,
    };
    const memoryRetrievalService = {
      build: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [retrievedEntry],
        prompt:
          '## Retrieved Memory\n\nMatched entries: 1\n- project/warning: Never commit OPENAI_API_KEY=sk-1234567890abcdef.',
      })),
    };
    const memoryGovernanceService = {
      apply: vi.fn(() => ({
        generatedAt: Date.now(),
        entryCount: 1,
        entries: [
          {
            ...retrievedEntry,
            content: 'Never commit OPENAI_API_KEY=[REDACTED_SECRET].',
            redacted: true,
            originalLength: retrievedEntry.content.length,
          },
        ],
        droppedEntries: [],
        redactionCount: 1,
        prompt:
          '## Retrieved Memory\n\nMemory safety:\n- Dropped entries: 0\n- Redacted secrets: 1\n\nMatched entries: 1\n- project/warning: Never commit OPENAI_API_KEY=[REDACTED_SECRET].',
      })),
    };

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      repoMapService,
      userPreferenceMemoryService,
      projectMemoryService,
      memoryRetrievalService,
      memoryGovernanceService,
    });

    await loop.execute('提交前检查 secret 风险');

    const modelMessage = modelService.chatWithTools.mock.calls[0][0];
    expect(memoryGovernanceService.apply).toHaveBeenCalledWith([retrievedEntry]);
    expect(modelMessage).toContain('[REDACTED_SECRET]');
    expect(modelMessage).toContain('Memory safety:');
    expect(modelMessage).not.toContain('sk-1234567890abcdef');
  });

  it('should run verification after model-guided file changes', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => {
        eventBus.emit('file_change', {
          change: {
            toolName: 'write_file',
            path: 'tmp-agent-loop-file.ts',
            relativePath: 'tmp-agent-loop-file.ts',
            kind: 'created',
            beforeContent: '',
            afterContent: 'export {}',
            diff: '+ export {}',
          },
        });

        return {
          content: 'Changed file',
          model: 'test-model',
        };
      }),
    };
    const verificationService = {
      verify: vi.fn(async () => ({
        success: true,
        commands: [],
        summary: 'Verification passed:\n- PASS npm run typecheck (10ms)',
      })),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      verificationService,
    });

    const result = await loop.execute('create a file');

    expect(verificationService.verify).toHaveBeenCalledOnce();
    expect(result.verification?.success).toBe(true);
    expect(result.fileChanges?.map((change) => change.relativePath)).toEqual([
      'tmp-agent-loop-file.ts',
    ]);
    expect(result.response?.content).toContain('Changed file');
    expect(result.response?.content).toContain('## Task Report');
    expect(result.response?.content).toContain('Verification passed');
    expect(messages.at(-1)?.content).toContain('Verification passed');
    expect(events.map((event) => event.phase)).toContain('verifying');
  });

  it('should attempt one repair when verification fails', async () => {
    const modelService = {
      chatWithTools: vi.fn(async (message: string) => {
        eventBus.emit('file_change', {
          change: {
            toolName: 'write_file',
            path: 'src/foo.ts',
            relativePath: 'src/foo.ts',
            kind: 'modified',
            beforeContent: 'const value: number = 1;',
            afterContent: 'const value: number = "wrong";',
            diff: '- const value: number = 1;\n+ const value: number = "wrong";',
          },
        });

        return {
          content: message.includes('verification failed')
            ? 'Fixed the type error'
            : 'Changed file with a type error',
          model: 'test-model',
        };
      }),
    };
    const verificationService = {
      verify: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          commands: [
            {
              name: 'typecheck',
              command: 'npm run typecheck',
              success: false,
              exitCode: 1,
              stdout: '',
              stderr:
                "src/foo.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.",
              durationMs: 10,
            },
          ],
          summary: 'Verification failed:\n- FAIL npm run typecheck (10ms)',
        })
        .mockResolvedValueOnce({
          success: true,
          commands: [
            {
              name: 'typecheck',
              command: 'npm run typecheck',
              success: true,
              exitCode: 0,
              stdout: '',
              stderr: '',
              durationMs: 10,
            },
          ],
          summary: 'Verification passed:\n- PASS npm run typecheck (10ms)',
        }),
    };
    const verificationContext = {
      repoMap: {
        cwd: process.cwd(),
        generatedAt: Date.now(),
        projectType: ['typescript'],
        importantFiles: ['package.json'],
        sourceRoots: ['src'],
        files: [{ path: 'src/foo.ts', ext: '.ts', size: 10 }],
        index: {
          generatedAt: Date.now(),
          fileCount: 1,
          totalSize: 10,
          byExtension: { '.ts': 1 },
          directories: [],
          skipped: [],
        },
        gitDiff: {
          isGitRepository: true,
          changedFiles: [{ path: 'src/foo.ts', status: 'modified' as const }],
        },
        codeGraph: createEmptyCodeGraph(),
      },
      selectedFiles: [{ path: 'src/foo.ts', ext: '.ts', size: 10 }],
      prompt:
        '## Repository Context\nVerification files:\n- src/foo.ts\nLikely relevant files:\n- src/foo.ts',
    };
    const repoMapService = {
      selectForMessage: vi.fn(() => verificationContext),
      selectForVerificationIssues: vi.fn(() => verificationContext),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      verificationService,
      repoMapService,
    });

    const result = await loop.execute('change src/foo.ts');

    expect(modelService.chatWithTools).toHaveBeenCalledTimes(2);
    expect(repoMapService.selectForVerificationIssues).toHaveBeenCalledWith('change src/foo.ts', [
      expect.objectContaining({
        file: 'src/foo.ts',
        line: 1,
        column: 7,
      }),
    ]);
    expect(modelService.chatWithTools.mock.calls[1][0]).toContain(
      'Verification-driven repository context:'
    );
    expect(modelService.chatWithTools.mock.calls[1][0]).toContain('Verification files:');
    expect(verificationService.verify).toHaveBeenCalledTimes(2);
    expect(result.repair?.attempted).toBe(true);
    expect(result.completion?.evidence.repair).toEqual({
      attempted: true,
      resolved: true,
    });
    expect(result.verification?.success).toBe(true);
    expect(result.fileChanges?.map((change) => change.relativePath)).toEqual([
      'src/foo.ts',
      'src/foo.ts',
    ]);
    expect(result.response?.content).toContain('Verification failed');
    expect(result.response?.content).toContain('Repair attempt');
    expect(result.response?.content).toContain('Fixed the type error');
    expect(result.response?.content).toContain('Final verification passed');
    expect(events.map((event) => event.phase)).toContain('repairing');
  });

  it('should remain incomplete when final verification still fails', async () => {
    const modelService = {
      chatWithTools: vi.fn(async () => {
        eventBus.emit('file_change', {
          change: {
            toolName: 'edit_file',
            path: 'src/foo.ts',
            relativePath: 'src/foo.ts',
            kind: 'modified',
            beforeContent: 'const value = 1;',
            afterContent: 'const value: number = "wrong";',
            diff: '- const value = 1;\n+ const value: number = "wrong";',
          },
        });

        return {
          content: 'Attempted the requested change',
          model: 'test-model',
        };
      }),
    };
    const failedVerification = {
      success: false,
      commands: [],
      summary: 'Verification failed.',
    };
    const verificationService = {
      verify: vi.fn(async () => failedVerification),
    };
    const events: AgentLoopEvent[] = [];
    eventBus.on('agent_loop_event', (event: AgentLoopEvent) => events.push(event));

    const loop = new AgentLoop({
      modelService,
      toolManager,
      sessionService,
      eventBus,
      verificationService,
    });

    const result = await loop.execute('introduce and repair a type error');

    expect(result.success).toBe(false);
    expect(result.completion?.status).toBe('incomplete');
    expect(result.completion?.reasons).toContain('Final verification failed.');
    expect(result.completion?.blockerCodes).toContain('VERIFICATION_FAILED');
    expect(result.completion?.evidence.repair.attempted).toBe(true);
    expect(result.failureRecoveryPrompt).toContain('## Failure Recovery Prompt');
    expect(result.failureRecoveryPrompt).toContain(
      '- [VERIFICATION_FAILED] Final verification failed.'
    );
    expect(result.structuredOutput).toMatchObject({
      schemaVersion: 1,
      status: 'incomplete',
      success: false,
      failureRecoveryPrompt: expect.stringContaining('## Failure Recovery Prompt'),
      completion: {
        status: 'incomplete',
        reasons: expect.arrayContaining(['Final verification failed.']),
      },
    });
    expect(result.response?.content).toContain('Recovery: required');
    expect(result.response?.content).toContain('## Failure Recovery Prompt');
    expect(events.at(-1)?.phase).toBe('incomplete');
    expect(events.map((event) => event.phase)).not.toContain('completed');
  });
});

function createEmptyCodeGraph() {
  return {
    generatedAt: Date.now(),
    fileCount: 0,
    files: [],
    edges: [],
    parseErrors: [],
  };
}
