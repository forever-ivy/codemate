#!/usr/bin/env npx tsx

/**
 * 测试Help命令和输入框清空的完整流程
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { EnhancedInput } from './src/ui/components/EnhancedInput.js';
import { ThemeProvider } from './src/ui/theme/ThemeSystem.js';
import { Container } from './src/application/Container.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';
import { SessionService } from './src/services/SessionService.js';
import { EventBus } from './src/services/EventBus.js';
import { Paths } from './src/services/Paths.js';
import { ClearCommand } from './src/commands/session/ClearCommand.js';
import { ExitCommand } from './src/commands/session/ExitCommand.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function TestHelpWithClear() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [container, setContainer] = useState<Container | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 初始化服务
  useEffect(() => {
    async function init() {
      try {
        // 创建基础服务
        const eventBus = new EventBus();
        const paths = new Paths({ 
          productName: 'aicli', 
          cwd: process.cwd() 
        });
        const sessionService = new SessionService(paths, eventBus);
        const commandManager = new SlashCommandManager();

        // 创建容器
        const newContainer = new Container();
        newContainer.register('session', sessionService);
        newContainer.register('command', commandManager);

        // 注册命令
        const helpCommand = new EnhancedHelpCommand();
        const clearCommand = new ClearCommand();
        const exitCommand = new ExitCommand();

        commandManager.register(helpCommand);
        commandManager.register(clearCommand);
        commandManager.register(exitCommand);

        // 初始化会话
        await sessionService.initialize();
        const session = await sessionService.create('Test Help with Clear');

        // 监听消息添加
        const originalAddMessage = sessionService.addMessage.bind(sessionService);
        sessionService.addMessage = async (message: any) => {
          setMessages(prev => [...prev, message]);
          return originalAddMessage(message);
        };

        setContainer(newContainer);
        setIsReady(true);
        console.log('✅ Services initialized');
      } catch (error) {
        console.error('❌ Initialization failed:', error);
      }
    }

    init();
  }, []);

  const handleSubmit = async (value: string) => {
    if (!container || !isReady) return;

    try {
      // 添加用户消息
      setMessages(prev => [...prev, { role: 'user', content: value }]);

      // 检查是否是命令
      const commandManager = container.get<SlashCommandManager>('command');
      const mockApp = { getContainer: () => container } as any;

      if (commandManager.isCommand(value.trim())) {
        // 执行命令
        await commandManager.execute(value.trim(), mockApp);
      } else {
        // 普通消息
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Echo: ${value}` 
        }]);
      }
    } catch (error) {
      console.error('❌ Command execution failed:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }]);
    }
  };

  return (
    <ThemeProvider>
      <Box flexDirection="column" height="100%">
        <Box flexDirection="column" flexGrow={1} padding={1}>
          <Text bold color="blue">🧪 Help Command + Input Clear Test</Text>
          <Text>Type "/help" and press Enter. The input should clear after submission.</Text>
          <Text>Press Ctrl+C to exit</Text>
          <Text></Text>

          {!isReady && (
            <Text color="yellow">⏳ Initializing services...</Text>
          )}

          {/* 消息列表 */}
          <Box flexDirection="column" marginBottom={1}>
            {messages.map((msg, index) => (
              <Box key={index} marginBottom={1}>
                <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
                  {msg.role === 'user' ? '👤' : '🤖'} {msg.role}:
                </Text>
                <Text> {msg.content}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 输入区域 */}
        {isReady && (
          <Box paddingX={1} paddingBottom={1}>
            <EnhancedInput
              onSubmit={handleSubmit}
              placeholder="Type /help and press Enter..."
              showSuggestions={true}
              showStatus={false}
            />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

async function testHelpWithClear() {
  console.log('🧪 Starting Help Command + Input Clear Test');
  console.log('=' .repeat(60));
  console.log('Instructions:');
  console.log('1. Wait for services to initialize');
  console.log('2. Type "/help" and press Enter');
  console.log('3. Verify that:');
  console.log('   - Help command output appears');
  console.log('   - Input box is cleared after pressing Enter');
  console.log('4. Try typing "/help clear" for specific command help');
  console.log('5. Press Ctrl+C to exit');
  console.log('=' .repeat(60));
  console.log();

  const { unmount } = render(React.createElement(TestHelpWithClear));

  // 处理退出
  process.on('SIGINT', () => {
    console.log('\n👋 Exiting...');
    unmount();
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});
}

// 运行测试
testHelpWithClear().catch(console.error);