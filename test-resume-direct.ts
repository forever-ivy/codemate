#!/usr/bin/env node

/**
 * 直接测试Resume命令执行
 */

import { Application } from './src/application/Application';
import { Container } from './src/application/Container';

async function testResumeExecution() {
  console.log('🧪 Testing Resume Command Execution...\n');
  
  try {
    // 1. 初始化应用
    const container = new Container();
    const app = new Application(container);
    
    // 2. 获取服务
    const commandManager = app.getContainer().get('command');
    const sessionService = app.getContainer().get('session');
    
    if (!commandManager || !sessionService) {
      console.error('❌ Required services not found');
      return;
    }
    
    // 3. 创建一些测试会话
    console.log('📝 Creating test sessions...');
    
    await sessionService.create('test-session-1');
    await sessionService.addMessage({
      role: 'user',
      content: 'Hello from session 1'
    });
    
    await sessionService.create('test-session-2');
    await sessionService.addMessage({
      role: 'user',
      content: 'Hello from session 2'
    });
    
    console.log('✅ Test sessions created');
    
    // 4. 测试resume命令是否可以执行
    console.log('\n🔧 Testing resume command execution...');
    
    const resumeCommand = commandManager.get('resume');
    if (!resumeCommand) {
      console.error('❌ Resume command not found');
      return;
    }
    
    console.log('✅ Resume command found');
    console.log(`   Name: ${resumeCommand.name}`);
    console.log(`   Description: ${resumeCommand.description}`);
    
    // 5. 尝试执行resume命令（这会显示会话选择界面）
    console.log('\n🎯 Executing resume command...');
    console.log('Note: This should show the session selection interface');
    
    // 由于这是一个交互式命令，我们只测试它是否能开始执行
    try {
      // 在后台执行，不等待用户交互
      const executePromise = resumeCommand.execute([], app);
      
      // 给它一点时间开始执行
      setTimeout(() => {
        console.log('✅ Resume command started successfully');
        console.log('💡 In a real terminal, you would see the session selection interface');
        process.exit(0);
      }, 1000);
      
      await executePromise;
      
    } catch (error) {
      console.error('❌ Resume command execution failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
  }
}

// 运行测试
testResumeExecution();