/**
 * 最终测试 /model 命令 - 验证事件触发
 */
import { Application } from './src/application/Application';
import type { ModelConfig } from './src/types/index';

async function testModelCommandFinal() {
  console.log('🧪 Final test of /model command...\n');

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
  await sessionService.create('test-model-final');
  console.log('✅ Session created\n');

  // 3. 监听模型选择器事件
  const eventBus = app.getContainer().get('eventBus');
  let eventTriggered = false;
  
  eventBus.on('show_model_selector', () => {
    console.log('🎉 Model selector event triggered!');
    eventTriggered = true;
  });

  // 4. 获取命令管理器并执行 /model 命令
  const commandManager = app.getContainer().get('command');
  
  console.log('📝 Executing /model command...\n');
  const success = await commandManager.execute('/model', app);

  if (success) {
    console.log('✅ Command executed successfully!');
    
    if (eventTriggered) {
      console.log('✅ Model selector event was triggered!');
      console.log('\n🎯 SUCCESS: The /model command now properly triggers the interactive model selector!');
      console.log('\n📋 What happens when you run the CLI:');
      console.log('   1. Type "/model" and press Enter');
      console.log('   2. Interactive model selector appears');
      console.log('   3. Use ↑↓ keys to navigate models');
      console.log('   4. Press Enter to select a model');
      console.log('   5. Press ESC to cancel');
    } else {
      console.log('❌ Model selector event was NOT triggered');
    }
  } else {
    console.log('❌ Command execution failed');
  }
}

testModelCommandFinal().catch(console.error);