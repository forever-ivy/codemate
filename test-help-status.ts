#!/usr/bin/env tsx

/**
 * 测试帮助命令是否正确显示 Status 命令
 */

import { Container } from './src/application/Container.js';
import { Application } from './src/application/Application.js';
import { HelpCommand } from './src/commands/session/HelpCommand.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';

async function testHelpWithStatus() {
  console.log('📚 Testing Help Command with Status...\n');

  try {
    // 创建应用实例
    const app = new Application();
    const container = app.getContainer();
    const commandManager = container.get<SlashCommandManager>('command');
    const sessionService = container.get('session');
    
    console.log('✅ Application initialized');

    // 创建一个测试会话
    await sessionService.create();
    console.log('✅ Test session created');

    // 1. 测试基础帮助命令
    console.log('\n📖 Testing basic HelpCommand...');
    const helpCommand = commandManager.get('help') as EnhancedHelpCommand;
    
    console.log('Help command type:', helpCommand.constructor.name);
    
    // 模拟执行帮助命令
    console.log('\n--- Executing Help Command ---');
    await helpCommand.execute([], app);
    
    // 获取会话消息来查看帮助输出
    const session = sessionService.getCurrent();
    if (session && session.messages.length > 0) {
      const lastMessage = session.messages[session.messages.length - 1];
      console.log('Help output:');
      console.log(lastMessage.content);
    }
    console.log('--- End Help Output ---\n');

    // 2. 测试特定命令帮助
    console.log('📖 Testing help for status command...');
    console.log('\n--- Help for Status Command ---');
    await helpCommand.execute(['status'], app);
    
    const statusHelpSession = sessionService.getCurrent();
    if (statusHelpSession && statusHelpSession.messages.length > 0) {
      const lastMessage = statusHelpSession.messages[statusHelpSession.messages.length - 1];
      console.log('Status help output:');
      console.log(lastMessage.content);
    }
    console.log('--- End Status Help ---\n');

    // 3. 检查所有注册的命令
    console.log('📋 All registered commands:');
    const allCommands = commandManager.getAllInfo();
    const statusCommand = allCommands.find(cmd => cmd.name === 'status');
    
    if (statusCommand) {
      console.log('✅ Status command found in command list:');
      console.log(`  /${statusCommand.name} (${statusCommand.aliases.join(', ')}) - ${statusCommand.description}`);
    } else {
      console.log('❌ Status command not found in command list');
    }

    console.log('\n📊 Status command details:');
    console.log(`Total commands: ${allCommands.length}`);
    console.log('Commands containing "status":', allCommands.filter(cmd => 
      cmd.name.includes('status') || cmd.description.toLowerCase().includes('status')
    ).length);

    console.log('\n✅ Help command tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.main) {
  testHelpWithStatus().catch(console.error);
}