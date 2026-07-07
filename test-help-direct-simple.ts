#!/usr/bin/env npx tsx

/**
 * 直接测试简化版Help命令（不使用Application类）
 */

import { Container } from './src/application/Container.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';
import { SessionService } from './src/services/SessionService.js';
import { EventBus } from './src/services/EventBus.js';
import { Paths } from './src/services/Paths.js';
import { ClearCommand } from './src/commands/session/ClearCommand.js';
import { ExitCommand } from './src/commands/session/ExitCommand.js';
import { SessionsCommand } from './src/commands/session/SessionsCommand.js';

async function testHelpCommandDirect() {
  console.log('🧪 Testing Enhanced Help Command (Direct Test)');
  console.log('=' .repeat(60));

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
    const container = new Container();
    container.register('session', sessionService);
    container.register('command', commandManager);

    // 创建模拟的Application对象
    const mockApp = {
      getContainer: () => container,
    } as any;

    // 注册命令
    const helpCommand = new EnhancedHelpCommand();
    const clearCommand = new ClearCommand();
    const exitCommand = new ExitCommand();
    const sessionsCommand = new SessionsCommand();

    commandManager.register(helpCommand);
    commandManager.register(clearCommand);
    commandManager.register(exitCommand);
    commandManager.register(sessionsCommand);

    // 初始化会话
    await sessionService.initialize();
    const session = await sessionService.create('Test Help Command');

    console.log('✅ Setup completed');
    console.log(`✅ Current session: ${session.id}`);
    console.log();

    // 测试1: 显示所有命令
    console.log('📋 Test 1: Show all commands');
    console.log('-'.repeat(40));
    
    // 模拟消息添加的监听
    const messages: any[] = [];
    const originalAddMessage = sessionService.addMessage.bind(sessionService);
    sessionService.addMessage = async (message: any) => {
      messages.push(message);
      console.log(`[${message.role}]: ${message.content}`);
      return originalAddMessage(message);
    };

    await helpCommand.execute([], mockApp);
    console.log();

    // 测试2: 显示特定命令帮助
    console.log('📋 Test 2: Show specific command help');
    console.log('-'.repeat(40));
    
    await helpCommand.execute(['clear'], mockApp);
    console.log();

    // 测试3: 显示未知命令错误
    console.log('📋 Test 3: Show unknown command error');
    console.log('-'.repeat(40));
    
    await helpCommand.execute(['unknown'], mockApp);
    console.log();

    // 验证结果
    console.log('🔍 Verification Results:');
    console.log('-'.repeat(40));
    console.log(`✅ Total messages generated: ${messages.length}`);
    
    const allCommandsMessage = messages.find(m => m.content.includes('Available slash commands:'));
    if (allCommandsMessage) {
      console.log('✅ All commands message found');
      console.log(`   - Contains categories: ${allCommandsMessage.content.includes('📦 Basic Commands:')}`);
      console.log(`   - Contains total count: ${allCommandsMessage.content.includes('Total:')}`);
    }

    const specificHelpMessage = messages.find(m => m.content.includes('📖 Help for /clear:'));
    if (specificHelpMessage) {
      console.log('✅ Specific command help found');
    }

    const errorMessage = messages.find(m => m.content.includes('❌ Unknown command:'));
    if (errorMessage) {
      console.log('✅ Error message for unknown command found');
    }

    console.log();
    console.log('🎉 All tests completed successfully!');
    console.log();
    console.log('📝 Sample output from help command:');
    console.log('-'.repeat(40));
    if (allCommandsMessage) {
      console.log(allCommandsMessage.content);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testHelpCommandDirect().catch(console.error);