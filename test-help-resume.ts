#!/usr/bin/env node

/**
 * 测试Help命令是否显示Resume命令
 */

import { Application } from './src/application/Application';
import { Container } from './src/application/Container';

async function testHelpCommand() {
  console.log('🧪 Testing Help Command Output...\n');
  
  try {
    // 1. 初始化应用
    const container = new Container();
    const app = new Application(container);
    
    // 2. 获取命令管理器和会话服务
    const commandManager = app.getContainer().get('command');
    const sessionService = app.getContainer().get('session');
    
    if (!commandManager || !sessionService) {
      console.error('❌ Required services not found');
      return;
    }
    
    // 3. 创建一个测试会话
    await sessionService.create('test-help-session');
    
    // 4. 获取help命令并执行
    const helpCommand = commandManager.get('help');
    if (!helpCommand) {
      console.error('❌ Help command not found');
      return;
    }
    
    console.log('🔧 Executing help command...');
    await helpCommand.execute([], app);
    
    // 5. 获取会话中的最后一条消息（help输出）
    const currentSession = sessionService.getCurrent();
    if (!currentSession || currentSession.messages.length === 0) {
      console.error('❌ No messages found in session');
      return;
    }
    
    const lastMessage = currentSession.messages[currentSession.messages.length - 1];
    if (lastMessage.role !== 'assistant') {
      console.error('❌ Last message is not from assistant');
      return;
    }
    
    const helpOutput = lastMessage.content;
    console.log('📋 Help command output:');
    console.log('=' .repeat(60));
    console.log(helpOutput);
    console.log('=' .repeat(60));
    
    // 6. 检查resume命令是否在输出中
    const hasResume = helpOutput.includes('/resume');
    console.log(`\n✅ Resume command in help output: ${hasResume ? 'YES' : 'NO'}`);
    
    if (hasResume) {
      // 提取resume命令行
      const lines = helpOutput.split('\n');
      const resumeLine = lines.find(line => line.includes('/resume'));
      if (resumeLine) {
        console.log(`📝 Resume command line: "${resumeLine.trim()}"`);
      }
    }
    
    // 7. 检查会话管理分类
    const hasSessionManagement = helpOutput.includes('💬 Session Management:');
    console.log(`✅ Session Management category: ${hasSessionManagement ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  }
}

// 运行测试
testHelpCommand();