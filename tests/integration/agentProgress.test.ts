/**
 * AgentProgress系统集成测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Application } from '../../src/application/Application';
import { Container } from '../../src/application/Container';
import { SessionService } from '../../src/services/SessionService';
import { EventBus } from '../../src/services/EventBus';
import { ConfigService } from '../../src/services/ConfigService';
import { Paths } from '../../src/services/Paths';
import type { EnhancedMessage } from '../../src/types/index';
import { splitMessages } from '../../src/ui/utils/messageSplitter';
import { calculateStats, groupMessages } from '../../src/ui/components/AgentProgress/utils';

describe('AgentProgress Integration', () => {
  let app: Application;
  let container: Container;
  let sessionService: SessionService;
  let eventBus: EventBus;

  beforeEach(async () => {
    // 创建测试容器
    container = new Container();

    // 注册核心服务
    const paths = new Paths({ productName: 'test-ai-cli', cwd: process.cwd() });
    const configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'test-ai-cli',
      argvConfig: {},
    });
    eventBus = new EventBus();
    sessionService = new SessionService(eventBus, paths);

    container.register('paths', paths);
    container.register('config', configService);
    container.register('eventBus', eventBus);
    container.register('session', sessionService);

    // 创建应用实例
    app = new Application(container);
  });

  afterEach(async () => {
    // 清理测试数据
    if (sessionService) {
      await sessionService.clear();
    }
  });

  it('should handle complete agent task execution flow', async () => {
    // 1. 创建会话
    const session = await sessionService.create();
    expect(session).toBeDefined();

    // 2. 添加用户消息
    const userMessage: EnhancedMessage = {
      role: 'user',
      content: 'Please analyze the project structure',
      timestamp: Date.now(),
    };
    await sessionService.addMessage(userMessage);

    // 3. 添加包含工具使用的assistant消息
    const assistantMessage: EnhancedMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I will analyze the project structure for you.' },
        {
          type: 'tool_use',
          id: 'task-123',
          name: 'task',
          input: {
            subagent_type: 'file-explorer',
            description: 'Analyze project structure',
            prompt: 'List all files and directories in the project',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(assistantMessage);

    // 4. 模拟工具执行过程中的进度更新
    const progressMessages: EnhancedMessage[] = [
      {
        role: 'user',
        content: 'Starting file exploration...',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'bash-1',
            name: 'bash',
            input: { command: 'find . -type f -name "*.ts" | head -10' },
          },
        ],
        timestamp: Date.now(),
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            id: 'bash-1',
            result: {
              isError: false,
              llmContent: './src/cli.ts\n./src/index.ts\n./src/types/index.ts',
            },
          },
        ],
        timestamp: Date.now(),
      },
    ];

    // 5. 添加工具结果
    const toolResult: EnhancedMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          id: 'task-123',
          result: {
            isError: false,
            returnDisplay: {
              type: 'agent_result',
              status: 'completed',
              content: 'Project structure analysis completed. Found 15 TypeScript files.',
              stats: {
                toolCalls: 3,
                tokens: { input: 150, output: 300 },
                duration: 5000,
              },
            },
            llmContent: 'Analysis complete',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(toolResult);

    // 6. 验证消息分离
    const currentSession = sessionService.getCurrent();
    expect(currentSession).toBeDefined();

    const messages = currentSession!.messages as EnhancedMessage[];
    const { completedMessages, pendingMessages } = splitMessages(messages);

    // 所有工具都已完成，应该没有pending消息
    expect(pendingMessages).toHaveLength(0);
    expect(completedMessages).toHaveLength(messages.length);

    // 7. 验证统计计算
    const stats = calculateStats(progressMessages);
    expect(stats.toolCalls).toBeGreaterThan(0);
    expect(stats.tokens).toBeGreaterThanOrEqual(0);

    // 8. 验证消息分组
    const logItems = groupMessages(progressMessages);
    expect(logItems.length).toBeGreaterThan(0);

    // 应该包含用户消息、工具使用和工具结果
    const userItems = logItems.filter((item) => item.type === 'user');
    const toolItems = logItems.filter((item) => item.type === 'tool');

    expect(userItems.length).toBeGreaterThan(0);
    expect(toolItems.length).toBeGreaterThan(0);
  });

  it('should handle pending agent tasks correctly', async () => {
    // 1. 创建会话
    const session = await sessionService.create();

    // 2. 添加未完成的工具使用
    const userMessage: EnhancedMessage = {
      role: 'user',
      content: 'Start a long-running task',
      timestamp: Date.now(),
    };
    await sessionService.addMessage(userMessage);

    const assistantMessage: EnhancedMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Starting the task...' },
        {
          type: 'tool_use',
          id: 'long-task-456',
          name: 'task',
          input: {
            subagent_type: 'general',
            description: 'Long running analysis',
            prompt: 'Perform comprehensive code analysis',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(assistantMessage);

    // 3. 验证消息分离 - 应该有pending消息
    const currentSession = sessionService.getCurrent();
    const messages = currentSession!.messages as EnhancedMessage[];
    const { completedMessages, pendingMessages } = splitMessages(messages);

    expect(pendingMessages).toHaveLength(1); // assistant消息应该在pending中
    expect(completedMessages).toHaveLength(1); // 只有user消息在completed中
    expect(pendingMessages[0].role).toBe('assistant');
  });

  it('should handle multiple concurrent agent tasks', async () => {
    // 1. 创建会话
    const session = await sessionService.create();

    // 2. 添加包含多个工具使用的消息
    const assistantMessage: EnhancedMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Running multiple tasks concurrently...' },
        {
          type: 'tool_use',
          id: 'task-1',
          name: 'task',
          input: {
            subagent_type: 'file-explorer',
            description: 'Explore files',
            prompt: 'List all files',
          },
        },
        {
          type: 'tool_use',
          id: 'task-2',
          name: 'task',
          input: {
            subagent_type: 'code-analyzer',
            description: 'Analyze code',
            prompt: 'Check code quality',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(assistantMessage);

    // 3. 只完成第一个任务
    const partialResult: EnhancedMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          id: 'task-1',
          result: {
            isError: false,
            returnDisplay: 'File exploration completed',
            llmContent: 'Files listed',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(partialResult);

    // 4. 验证消息分离 - 应该仍有pending消息（task-2未完成）
    const currentSession = sessionService.getCurrent();
    const messages = currentSession!.messages as EnhancedMessage[];
    const { completedMessages, pendingMessages } = splitMessages(messages);

    expect(pendingMessages).toHaveLength(2); // assistant + partial result
    expect(completedMessages).toHaveLength(0); // 没有完全完成的消息

    // 5. 完成第二个任务
    const finalResult: EnhancedMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          id: 'task-2',
          result: {
            isError: false,
            returnDisplay: 'Code analysis completed',
            llmContent: 'Analysis done',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(finalResult);

    // 6. 验证所有任务完成后的状态
    const updatedSession = sessionService.getCurrent();
    const updatedMessages = updatedSession!.messages as EnhancedMessage[];
    const { completedMessages: finalCompleted, pendingMessages: finalPending } =
      splitMessages(updatedMessages);

    expect(finalPending).toHaveLength(0); // 所有任务完成
    expect(finalCompleted).toHaveLength(updatedMessages.length);
  });

  it('should handle agent task errors correctly', async () => {
    // 1. 创建会话
    const session = await sessionService.create();

    // 2. 添加失败的工具使用
    const assistantMessage: EnhancedMessage = {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'failing-task',
          name: 'task',
          input: {
            subagent_type: 'general',
            description: 'This will fail',
            prompt: 'Do something impossible',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(assistantMessage);

    // 3. 添加错误结果
    const errorResult: EnhancedMessage = {
      role: 'tool',
      content: [
        {
          type: 'tool_result',
          id: 'failing-task',
          result: {
            isError: true,
            returnDisplay: 'Task failed: Invalid operation',
            llmContent: 'Error occurred during execution',
          },
        },
      ],
      timestamp: Date.now(),
    };
    await sessionService.addMessage(errorResult);

    // 4. 验证错误处理
    const currentSession = sessionService.getCurrent();
    const messages = currentSession!.messages as EnhancedMessage[];
    const { completedMessages, pendingMessages } = splitMessages(messages);

    // 即使失败，任务也算完成
    expect(pendingMessages).toHaveLength(0);
    expect(completedMessages).toHaveLength(messages.length);

    // 验证错误结果的内容
    const toolMessage = messages.find((m) => m.role === 'tool') as EnhancedMessage;
    expect(toolMessage).toBeDefined();
    const toolContent = toolMessage.content as any[];
    expect(toolContent[0].result.isError).toBe(true);
    expect(toolContent[0].result.returnDisplay).toContain('Task failed');
  });
});
