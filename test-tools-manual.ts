import { Application } from './src/application/Application';
import type { ToolManager } from './src/managers/ToolManager';

async function testTools() {
  console.log('🧪 开始手动测试工具...\n');

  // 1. 创建应用
  const app = new Application({
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  });

  // 2. 获取 ToolManager（使用类型断言）
  const toolManager = app['container'].get<ToolManager>('tool');

  // 3. 测试文件工具
  console.log('📁 测试文件工具...');
  await toolManager.execute('write_file', {
    path: 'test.txt',
    content: 'Hello World',
  });
  console.log('✅ 文件已写入\n');

  await toolManager.execute('read_file', {
    path: 'test.txt',
  });
  console.log('✅ 文件已读取\n');

  await toolManager.execute('edit_file', {
    path: 'test.txt',
    oldContent: 'Hello',
    newContent: 'Hi',
  });
  console.log('✅ 文件已编辑\n');

  // 4. 测试搜索工具
  console.log('🔍 测试搜索工具...');
  await toolManager.execute('grep', {
    pattern: 'Hi',
    path: 'test.txt',
  });
  console.log('✅ 搜索完成\n');

  // 5. 测试系统工具
  console.log('⚡ 测试系统工具...');
  await toolManager.execute('bash', {
    command: 'echo "Test"',
  });
  console.log('✅ 命令已执行\n');

  await toolManager.execute('env', {
    key: 'PATH',
  });
  console.log('✅ 环境变量已获取\n');

  // 6. 测试任务工具
  console.log('📋 测试任务工具...');
  await toolManager.execute('todo_write', {
    action: 'add',
    text: '测试待办事项',
  });
  console.log('✅ 待办已添加\n');

  await toolManager.execute('todo_read', {});
  console.log('✅ 待办已读取\n');

  // 7. 清理
  await toolManager.execute('delete_file', {
    path: 'test.txt',
  });
  console.log('✅ 测试文件已删除\n');

  // 8. 统计
  console.log('📊 工具统计:');
  console.log(`   总工具数: ${toolManager.count()}`);
  console.log(`   工具列表: ${toolManager.list().join(', ')}`);

  console.log('\n✅ 所有工具测试完成！');
}

testTools().catch(console.error);