import { Application } from './src/application/Application';
import type { SlashCommandManager } from './src/managers/SlashCommandManager';

async function testCommands() {
  console.log('🧪 开始手动测试命令...\n');

  // 1. 创建应用
  const app = new Application({
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  });

  // 2. 获取命令管理器
  const commandManager = app.getContainer().get<SlashCommandManager>('command');

  // 3. 测试 /help
  console.log('📖 测试 /help 命令...');
  await commandManager.execute('/help', app);
  console.log('');

  // 4. 测试 /sessions
  console.log('📚 测试 /sessions 命令...');
  await commandManager.execute('/sessions', app);
  console.log('');

  // 5. 测试别名
  console.log('🔤 测试别名 /h...');
  await commandManager.execute('/h', app);
  console.log('');

  // 6. 测试未知命令
  console.log('❓ 测试未知命令...');
  await commandManager.execute('/unknown', app);
  console.log('');

  // 7. 统计
  console.log('📊 命令统计:');
  console.log(`   总命令数: ${commandManager.count()}`);
  console.log(`   命令列表: ${commandManager.list().join(', ')}`);

  console.log('\n✅ 所有命令测试完成！');
}

testCommands().catch(console.error);