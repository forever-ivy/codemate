/**
 * 测试模型选择器布局修复
 */
import { Application } from './src/application/Application';
import type { ModelConfig } from './src/types/index';
import { App } from './src/ui/App';
import { render } from 'ink';
import React from 'react';

async function testModelLayoutFix() {
  console.log('🧪 Testing model selector layout fix...\n');

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
  await sessionService.create('test-model-layout');
  console.log('✅ Session created\n');

  console.log('🎮 Starting interactive UI with layout fix...');
  console.log('💡 Type "/model" and press Enter to test the full-screen model selector');
  console.log('💡 The model selector should now occupy the entire screen');
  console.log('💡 Use ↑↓ keys to navigate, Enter to select, ESC to cancel');
  console.log('💡 Use Ctrl+C to exit\n');

  // 3. 启动交互式UI
  const { waitUntilExit } = render(React.createElement(App, { app }));
  
  try {
    await waitUntilExit();
  } catch (error) {
    console.log('\n👋 Goodbye!');
  }
}

testModelLayoutFix().catch(console.error);