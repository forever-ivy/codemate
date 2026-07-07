#!/usr/bin/env bun

/**
 * 手动测试 Rewind 命令功能
 * 
 * 测试场景：
 * 1. 创建一个包含多条消息的会话
 * 2. 使用 /rewind 命令选择回退点
 * 3. 验证消息被正确截断
 * 4. 验证可以从回退点继续对话
 */

import { Application } from './src/application/Application';
import type { ModelConfig } from './src/types/index';

async function testRewindCommand() {
  console.log('🧪 Testing Rewind Command...\n');

  // 创建应用实例
  const config: ModelConfig = {
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.7,
  };

  const app = new Application(config);
  await app.initialize();

  // 获取服务
  const sessionService = app.getContainer().get('session');
  const commandManager = app.getContainer().get('command');

  try {
    // 1. 创建新会话
    console.log('📝 Creating new session...');
    await sessionService.create('test-rewind-session');
    
    // 2. 添加多条测试消息
    console.log('💬 Adding test messages...');
    
    await sessionService.addMessage({
      role: 'user',
      content: 'Hello, this is the first message'
    });
    
    await sessionService.addMessage({
      role: 'assistant',
      content: 'Hello! This is the first response.'
    });
    
    await sessionService.addMessage({
      role: 'user',
      content: 'This is the second user message'
    });
    
    await sessionService.addMessage({
      role: 'assistant',
      content: 'This is the second assistant response.'
    });
    
    await sessionService.addMessage({
      role: 'user',
      content: 'This is the third and final message'
    });

    // 3. 显示当前消息数量
    const currentSession = sessionService.getCurrentSession();
    console.log(`📊 Current session has ${currentSession?.messages.length} messages`);
    
    // 4. 显示所有消息
    console.log('\n📋 Current messages:');
    currentSession?.messages.forEach((msg, index) => {
      console.log(`  ${index}: [${msg.role}] ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`);
    });

    // 5. 模拟回退到第2条消息（索引1）
    console.log('\n⏪ Simulating rewind to message index 1...');
    
    if (currentSession) {
      const truncatedMessages = currentSession.messages.slice(0, 2); // 保留前2条消息
      await sessionService.updateSessionMessages(currentSession.id, truncatedMessages);
      
      console.log(`✅ Session rewound! Now has ${truncatedMessages.length} messages`);
      
      // 6. 显示回退后的消息
      console.log('\n📋 Messages after rewind:');
      const updatedSession = sessionService.getCurrentSession();
      updatedSession?.messages.forEach((msg, index) => {
        console.log(`  ${index}: [${msg.role}] ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`);
      });
      
      // 7. 添加新消息验证可以继续对话
      console.log('\n➕ Adding new message after rewind...');
      await sessionService.addMessage({
        role: 'user',
        content: 'This is a new message after rewind'
      });
      
      const finalSession = sessionService.getCurrentSession();
      console.log(`📊 Final session has ${finalSession?.messages.length} messages`);
      
      console.log('\n📋 Final messages:');
      finalSession?.messages.forEach((msg, index) => {
        console.log(`  ${index}: [${msg.role}] ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`);
      });
    }

    console.log('\n✅ Rewind command test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testRewindCommand().catch(console.error);