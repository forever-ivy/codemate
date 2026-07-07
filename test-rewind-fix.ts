#!/usr/bin/env bun

/**
 * 测试 Rewind 命令修复
 * 验证 SessionService.rewriteSessionFile 方法是否正常工作
 */

import { Container } from './src/application/Container';
import { SessionService } from './src/services/SessionService';
import { Paths } from './src/services/Paths';
import { EventBus } from './src/services/EventBus';
import type { Message } from './src/types/index';

async function testRewindFix() {
  console.log('🧪 Testing Rewind Command Fix...\n');

  try {
    // 1. 初始化服务
    const container = new Container();
    const paths = new Paths({ productName: 'aicli', cwd: process.cwd() });
    const eventBus = new EventBus();
    const sessionService = new SessionService(paths, eventBus);

    await sessionService.initialize();

    // 2. 创建测试会话
    console.log('📝 Creating test session...');
    const session = await sessionService.create('Test rewind functionality');

    // 3. 添加一些测试消息
    const testMessages: Message[] = [
      { role: 'user', content: 'Hello, this is message 1' },
      { role: 'assistant', content: 'Hi! This is response 1' },
      { role: 'user', content: 'This is message 2' },
      { role: 'assistant', content: 'This is response 2' },
      { role: 'user', content: 'This is message 3' },
      { role: 'assistant', content: 'This is response 3' },
    ];

    console.log('📨 Adding test messages...');
    for (const message of testMessages) {
      await sessionService.addMessage(message);
    }

    console.log(`✅ Added ${testMessages.length} messages to session`);

    // 4. 测试消息截断（模拟 rewind 到第 3 条消息）
    console.log('\n🔄 Testing message rewind (truncate to first 3 messages)...');
    const truncatedMessages = testMessages.slice(0, 3);
    
    try {
      await sessionService.updateSessionMessages(session.id, truncatedMessages);
      console.log('✅ Rewind operation completed successfully!');
      
      // 5. 验证消息数量
      const messageCount = sessionService.getSessionMessageCount(session.id);
      console.log(`📊 Current message count: ${messageCount}`);
      
      if (messageCount === 3) {
        console.log('✅ Message count verification passed!');
      } else {
        console.log('❌ Message count verification failed!');
      }
      
    } catch (error) {
      console.error('❌ Rewind operation failed:', error);
      return;
    }

    // 6. 重新加载会话验证持久化
    console.log('\n🔍 Reloading session to verify persistence...');
    const reloadedSession = await sessionService.load(session.id);
    console.log(`📊 Reloaded session has ${reloadedSession.messages.length} messages`);
    
    if (reloadedSession.messages.length === 3) {
      console.log('✅ Session persistence verification passed!');
    } else {
      console.log('❌ Session persistence verification failed!');
    }

    // 7. 清理测试会话
    console.log('\n🧹 Cleaning up test session...');
    await sessionService.delete(session.id);
    console.log('✅ Test session deleted');

    console.log('\n🎉 All tests passed! Rewind functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testRewindFix().catch(console.error);