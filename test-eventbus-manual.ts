import { EventBus } from './src/services/EventBus';
import { Paths } from './src/services/Paths';
import { SessionService } from './src/services/SessionService';
import { EventType } from './src/types/index';

async function testEventBus() {
  console.log('🧪 开始手动测试 EventBus...\n');

  // 1. 创建 EventBus
  const eventBus = new EventBus();

  // 2. 注册监听器
  console.log('📡 注册事件监听器...');
  
  eventBus.on(EventType.SESSION_CREATED, (data) => {
    console.log('✅ [Listener 1] 会话已创建:', data.session.id);
  });

  eventBus.on(EventType.SESSION_CREATED, (data) => {
    console.log('✅ [Listener 2] 会话已创建:', data.session.id);
  });

  eventBus.on(EventType.MESSAGE_SENT, (data) => {
    console.log('✅ [Listener] 消息已发送:', data.message.content);
  });

  console.log();

  // 3. 创建 SessionService
  const paths = new Paths({
    productName: 'aicli',
    cwd: process.cwd(),
  });

  const sessionService = new SessionService(paths, eventBus);
  await sessionService.initialize();

  // 4. 创建会话（应该触发事件）
  console.log('📝 创建会话...');
  const session = await sessionService.create('测试 EventBus');
  console.log();

  // 5. 添加消息（应该触发事件）
  console.log('📨 添加消息...');
  await sessionService.addMessage({
    role: 'user',
    content: '你好，EventBus！',
  });
  console.log();

  // 6. 测试 once
  console.log('📡 测试 once（一次性监听）...');
  eventBus.once(EventType.SESSION_CREATED, (data) => {
    console.log('✅ [Once Listener] 这条消息只会出现一次');
  });

  await sessionService.create('测试 once');
  await sessionService.create('测试 once 2');  // 不会触发 once 监听器
  console.log();

  // 7. 测试 off
  console.log('📡 测试 off（取消监听）...');
  const handler = (data: any) => {
    console.log('✅ [Removable Listener] 这条消息不应该出现');
  };
  
  eventBus.on(EventType.SESSION_CREATED, handler);
  eventBus.off(EventType.SESSION_CREATED, handler);
  
  await sessionService.create('测试 off');
  console.log();

  // 8. 统计信息
  console.log('📊 统计信息:');
  console.log(`   事件类型数量: ${eventBus.eventNames().length}`);
  console.log(`   session.created 监听器数量: ${eventBus.listenerCount(EventType.SESSION_CREATED)}`);
  console.log(`   message.sent 监听器数量: ${eventBus.listenerCount(EventType.MESSAGE_SENT)}`);
  console.log();

  console.log('✅ EventBus 测试完成！');
}

testEventBus().catch(console.error);