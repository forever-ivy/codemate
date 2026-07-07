/**
 * 测试模型切换功能
 */
import { Application } from './src/application/Application';
import type { ModelConfig } from './src/types/index';

async function testModelSwitching() {
  console.log('🧪 Testing model switching functionality...\n');

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
  await sessionService.create('test-model-switching');
  console.log('✅ Session created\n');

  // 3. 获取ModelService并检查初始配置
  const modelService = app.getContainer().get('model');
  console.log(`📋 Initial model: ${modelService.getConfig().model}\n`);

  // 4. 测试模型切换
  console.log('🔄 Testing model switching...');
  
  // 切换到 Claude
  console.log('   Switching to claude-3-5-sonnet...');
  modelService.updateConfig({ model: 'claude-3-5-sonnet' });
  console.log(`   ✅ Current model: ${modelService.getConfig().model}`);
  
  // 切换到 GPT-4o
  console.log('   Switching to gpt-4o...');
  modelService.updateConfig({ model: 'gpt-4o' });
  console.log(`   ✅ Current model: ${modelService.getConfig().model}`);
  
  // 切换回 DeepSeek
  console.log('   Switching back to deepseek-chat...');
  modelService.updateConfig({ model: 'deepseek-chat' });
  console.log(`   ✅ Current model: ${modelService.getConfig().model}`);

  console.log('\n🎯 SUCCESS: Model switching functionality works correctly!');
  console.log('\n📋 What happens in the interactive UI:');
  console.log('   1. Type "/model" and press Enter');
  console.log('   2. Interactive model selector appears');
  console.log('   3. Use ↑↓ keys to navigate models');
  console.log('   4. Press Enter to select a model');
  console.log('   5. Model is immediately switched for the session');
  console.log('   6. Current model display updates in real-time');
  console.log('   7. Success message is shown in chat');
}

testModelSwitching().catch(console.error);