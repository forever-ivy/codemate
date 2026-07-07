/**
 * 简单测试 /model 命令
 */
import { Application } from './src/application/Application';
import type { ModelConfig } from './src/types/index';

async function testModelCommand() {
  console.log('🧪 Testing /model command...\n');

  // 1. 创建应用实例
  const modelConfig: ModelConfig = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
    baseURL: 'https://api.deepseek.com',
  };

  const app = new Application(modelConfig);
  console.log('✅ Application initialized\n');

  // 2. 创建一个会话
  const sessionService = app.getContainer().get('session');
  await sessionService.create('test-model-command');
  console.log('✅ Session created\n');

  // 3. 获取命令管理器
  const commandManager = app.getContainer().get('command');
  
  // 4. 执行 /model 命令
  console.log('📝 Executing /model command...\n');
  const success = await commandManager.execute('/model', app);

  if (success) {
    console.log('\n✅ Command executed successfully!');
    
    // 5. 检查是否添加了消息
    const currentSession = sessionService.getCurrent();
    
    if (currentSession && currentSession.messages.length > 0) {
      console.log('\n📨 Last message:');
      const lastMessage = currentSession.messages[currentSession.messages.length - 1];
      console.log('---');
      console.log(lastMessage.content);
      console.log('---');
    } else {
      console.log('\n⚠️ No messages found in session');
    }
  } else {
    console.log('\n❌ Command execution failed');
  }
}

testModelCommand().catch(console.error);
