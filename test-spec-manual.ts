/**
 * Spec系统手动测试脚本
 * 
 * 用于手动测试Spec系统的各项功能
 */

import { SpecManager } from './src/spec/SpecManager.js';
import { EventBus } from './src/services/EventBus.js';
import { Paths } from './src/services/Paths.js';
import { calculateTaskProgress, formatTimeEstimate } from './src/spec/utils.js';

async function testSpecSystem() {
  console.log('🚀 开始测试Spec系统...\n');

  // 初始化服务
  const eventBus = new EventBus();
  const paths = new Paths({ productName: 'aicli', cwd: './test-data' });
  const specManager = new SpecManager(eventBus, paths);

  // 监听事件
  eventBus.on('spec_event', (event) => {
    console.log(`📡 事件: ${event.type} - ${event.specId}`);
  });

  try {
    // 初始化
    await specManager.initialize();
    console.log('✅ SpecManager 初始化成功');

    // 1. 创建文档
    console.log('\n📝 测试创建文档...');
    const document = await specManager.create({
      title: '用户认证系统',
      description: '实现完整的用户认证和授权功能',
      tags: ['auth', 'security', 'api'],
    });
    console.log(`✅ 创建文档: ${document.title} (${document.id})`);

    // 2. 添加任务
    console.log('\n📋 测试添加任务...');
    const task1 = await specManager.addTask(document.id, {
      title: '设计数据库模型',
      description: '设计用户、角色、权限相关的数据库表结构',
      priority: 'high',
      estimate: { hours: 4, confidence: 0.8 },
      tags: ['database', 'design'],
    });
    console.log(`✅ 添加任务: ${task1!.title}`);

    const task2 = await specManager.addTask(document.id, {
      title: '实现登录接口',
      description: '实现用户登录的API接口',
      priority: 'medium',
      estimate: { hours: 2, confidence: 0.9 },
      dependencies: [task1!.id],
      tags: ['api', 'auth'],
    });
    console.log(`✅ 添加任务: ${task2!.title}`);

    // 3. 更新任务状态
    console.log('\n🔄 测试更新任务...');
    await specManager.updateTask(document.id, task1!.id, {
      status: 'completed',
    });
    console.log(`✅ 完成任务: ${task1!.title}`);

    // 4. 查看进度
    console.log('\n📊 测试进度计算...');
    const updatedDoc = await specManager.get(document.id);
    const progress = calculateTaskProgress(updatedDoc!.tasks);
    console.log(`📈 进度: ${progress.completed}/${progress.total} (${progress.percentage}%)`);

    // 5. 列出文档
    console.log('\n📚 测试列出文档...');
    const docs = await specManager.list();
    console.log(`📋 找到 ${docs.total} 个文档:`);
    docs.items.forEach(doc => {
      console.log(`  - ${doc.title} (${doc.status})`);
    });

    // 6. 导出文档
    console.log('\n💾 测试导出功能...');
    const jsonExport = await specManager.export(document.id, {
      format: 'json',
      includeTasks: true,
      includeMetadata: true,
      includeHistory: false,
    });
    console.log(`✅ JSON导出长度: ${jsonExport.length} 字符`);

    const markdownExport = await specManager.export(document.id, {
      format: 'markdown',
      includeTasks: true,
      includeMetadata: true,
      includeHistory: false,
    });
    console.log(`✅ Markdown导出长度: ${markdownExport.length} 字符`);

    console.log('\n🎉 所有测试通过！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testSpecSystem().catch(console.error);