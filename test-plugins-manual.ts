import { Application } from './src/application/Application';
import { LoggerPlugin } from './src/plugins/builtin/LoggerPlugin';
import { PerformancePlugin } from './src/plugins/builtin/PerformancePlugin';
import { SecurityPlugin } from './src/plugins/builtin/SecurityPlugin';
import type { ToolManager } from './src/managers/ToolManager';

async function testPlugins() {
  console.log('🧪 开始手动测试插件...\n');

  // 1. 创建应用
  const app = new Application({
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  });

  // 2. 获取管理器
  const pluginManager = app.getPluginManager()!;
  const toolManager = app.getContainer().get<ToolManager>('tool');

  // 3. 加载插件
  console.log('📦 加载插件...');
  await pluginManager.load(new LoggerPlugin());
  await pluginManager.load(new PerformancePlugin());
  await pluginManager.load(new SecurityPlugin(false)); // 非严格模式
  console.log('');

  // 4. 列出插件
  console.log('📋 已加载的插件:');
  const plugins = pluginManager.getAllInfo();
  for (const plugin of plugins) {
    console.log(`  - ${plugin.name} v${plugin.version}: ${plugin.description}`);
  }
  console.log('');

  // 5. 测试工具执行（触发插件钩子）
  console.log('🔧 测试工具执行...');
  try {
    await toolManager.execute('read_file', { path: 'package.json' });
  } catch (error) {
    console.error('工具执行失败:', error);
  }
  console.log('');

  // 6. 卸载插件
  console.log('🗑️  卸载插件...');
  await pluginManager.unload('logger');
  console.log(`剩余插件: ${pluginManager.count()}`);
  console.log('');

  // 7. 卸载所有插件
  console.log('🗑️  卸载所有插件...');
  await pluginManager.unloadAll();
  console.log(`剩余插件: ${pluginManager.count()}`);

  console.log('\n✅ 所有插件测试完成！');
}

testPlugins().catch(console.error);