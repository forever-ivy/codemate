#!/usr/bin/env bun

/**
 * 测试Compact命令实现
 * 验证会话历史压缩功能
 */

import { Application } from './src/application/Application';
import { CompactCommand } from './src/commands/session/CompactCommand';

async function testCompactCommand() {
  console.log('🧪 测试Compact命令实现...\n');

  try {
    // 创建应用实例
    const app = new Application({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
      model: 'claude-3-5-sonnet-20241022',
    });

    await app.start();

    const container = app.getContainer();
    const sessionService = container.get('session');

    // 1. 创建会话并添加多条消息
    console.log('📝 创建会话并添加测试消息...');
    await sessionService.create();

    const testMessages = [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you for asking!' },
      { role: 'user', content: 'Can you help me with a coding problem?' },
      { role: 'assistant', content: 'Of course! I would be happy to help you with your coding problem. What do you need assistance with?' },
      { role: 'user', content: 'I need to implement a binary search algorithm in TypeScript.' },
      { role: 'assistant', content: 'Sure! Here is a simple implementation of binary search in TypeScript...' },
    ];

    for (const msg of testMessages) {
      await sessionService.addMessage(msg);
    }

    const beforeCompact = sessionService.getMessages();
    console.log(`   消息数量(压缩前): ${beforeCompact.length}\n`);

    // 2. 执行compact命令
    console.log('🔄 执行compact命令...');
    const compactCommand = new CompactCommand();
    await compactCommand.execute([], app);

    // 3. 验证结果
    console.log('\n✅ 验证结果:');
    const afterCompact = sessionService.getMessages();
    console.log(`   消息数量(压缩后): ${afterCompact.length}`);
    console.log(`   压缩成功: ${afterCompact.length < beforeCompact.length ? '是' : '否'}`);

    if (afterCompact.length > 0) {
      console.log(`\n📄 压缩后的消息内容:`);
      console.log(`   角色: ${afterCompact[0].role}`);
      console.log(`   内容预览: ${afterCompact[0].content.substring(0, 100)}...`);
    }

    // 4. 测试空会话
    console.log('\n🧪 测试空会话压缩...');
    await sessionService.create();
    await compactCommand.execute([], app);

    // 5. 性能测试
    console.log('\n⚡ 性能测试:');
    await sessionService.create();
    for (let i = 0; i < 10; i++) {
      await sessionService.addMessage({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i}`,
      });
    }

    const startTime = Date.now();
    await compactCommand.execute([], app);
    const endTime = Date.now();
    console.log(`   执行时间: ${endTime - startTime}ms`);

    console.log('\n🎉 Compact命令测试完成！');

    await app.stop();
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testCompactCommand();
