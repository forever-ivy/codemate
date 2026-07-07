/**
 * 手动测试：会话分叉功能
 *
 * 运行方式：
 * pnpm tsx test-fork-manual.ts
 */

import { SessionService } from './src/services/SessionService';
import { EventBus } from './src/services/EventBus';
import { Paths } from './src/services/Paths';
import type { EnhancedMessage } from './src/types/index';

async function testSessionFork() {
  console.log('🧪 测试会话分叉功能\n');

  // 1. 初始化服务
  const eventBus = new EventBus();
  const paths = new Paths({
    productName: 'test-codemate',
    cwd: process.cwd()
  });
  const sessionService = new SessionService(paths, eventBus);
  await sessionService.initialize();

  // 2. 创建会话
  console.log('📝 创建新会话...');
  const session = await sessionService.create('Test Fork Session');
  console.log(`✅ 会话创建成功: ${session.id}\n`);

  // 3. 添加消息
  console.log('📨 添加消息...');
  await sessionService.addEnhancedMessage({
    role: 'user',
    content: '帮我写一个函数',
    parentUuid: null
  });

  const messages = session.messages as EnhancedMessage[];
  await sessionService.addEnhancedMessage({
    role: 'assistant',
    content: '这是方案 A：使用递归实现',
    parentUuid: messages[0].uuid
  });

  await sessionService.addEnhancedMessage({
    role: 'user',
    content: '继续优化',
    parentUuid: messages[1].uuid
  });

  console.log(`✅ 添加了 ${messages.length} 条消息\n`);

  // 4. 显示消息树
  console.log('🌳 消息树结构:');
  for (const msg of messages) {
    const indent = msg.parentUuid ? '  └─ ' : '';
    console.log(`${indent}[${msg.uuid.slice(0, 8)}] ${msg.role}: ${msg.content}`);
  }
  console.log();

  // 5. 从第一条消息分叉
  console.log('🔀 从第一条消息分叉...');
  const forkedSession = await sessionService.fork({
    fromMessageUuid: messages[0].uuid
  });

  const forkedMessages = forkedSession.messages as EnhancedMessage[];
  console.log(`✅ 分叉成功: ${forkedSession.id}`);
  console.log(`   原会话消息数: ${messages.length}`);
  console.log(`   分叉会话消息数: ${forkedMessages.length}\n`);

  // 6. 显示分叉后的消息
  console.log('📋 分叉会话的消息:');
  for (const msg of forkedMessages) {
    console.log(`  [${msg.uuid.slice(0, 8)}] ${msg.role}: ${msg.content}`);
  }
  console.log();

  // 7. 在分叉会话中添加新消息
  sessionService.setCurrent(forkedSession);
  await sessionService.addEnhancedMessage({
    role: 'user',
    content: '换个方案，用迭代实现',
    parentUuid: forkedMessages[0].uuid
  });

  const updatedMessages = forkedSession.messages as EnhancedMessage[];
  console.log('✅ 在分叉会话中添加了新消息');
  console.log(`   当前消息数: ${updatedMessages.length}\n`);

  // 8. 测试活跃消息过滤
  console.log('🔍 测试活跃消息过滤...');
  const activeMessages = sessionService.getActiveMessages();
  console.log(`✅ 活跃消息数: ${activeMessages.length}`);
  for (const msg of activeMessages) {
    console.log(`  [${msg.uuid.slice(0, 8)}] ${msg.role}: ${msg.content}`);
  }

  console.log('\n✅ 所有测试完成！');
}

// 运行测试
testSessionFork().catch(console.error);
