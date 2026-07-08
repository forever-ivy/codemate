#!/usr/bin/env tsx

/**
 * 手动测试脚本 - 验证实施计划生成功能
 */

import { Application } from './src/application/Application.js';
import { ConfigService } from './src/services/ConfigService.js';
import { SpecWritePlanCommand } from './src/commands/spec/SpecWritePlanCommand.js';

async function testPlanGeneration() {
  console.log('🧪 开始测试实施计划生成功能...\n');

  try {
    // 1. 初始化应用
    console.log('📦 初始化应用...');
    const configService = new ConfigService();
    const modelConfig = configService.getModelConfig();
    const app = new Application(modelConfig, configService);
    await app.start();
    console.log('✅ 应用初始化完成\n');

    // 2. 创建测试规格文档
    console.log('📄 创建测试规格文档...');
    const specManager = app.getContainer().get('spec');
    const testSpec = await specManager.create({
      title: '测试用户认证系统',
      description: '用于测试计划生成的示例规格文档',
      content: `# 用户认证系统

## 功能需求

### 用户注册
- 支持邮箱注册
- 邮箱验证功能
- 密码强度验证

### 用户登录
- 邮箱/用户名登录
- 记住登录状态
- 密码重置功能

### 权限管理
- 基于角色的权限控制
- 多级权限支持
- 权限继承机制

## 技术要求
- 后端：Node.js + Express
- 数据库：PostgreSQL
- 前端：React
- 认证：JWT

## 非功能需求
- 支持1000+并发用户
- 99.9%可用性
- 数据加密存储`,
      projectPath: process.cwd(),
    });

    console.log(`✅ 创建测试规格文档: ${testSpec.id}\n`);

    // 3. 测试计划生成命令
    const command = new SpecWritePlanCommand();
    
    console.log('📋 测试1: 基础计划生成...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await command.execute([testSpec.id], app);
    
    console.log('\n📋 测试2: 详细计划生成...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await command.execute([testSpec.id, '--detailed', '--team-size', 'large'], app);
    
    console.log('\n📋 测试3: 简化计划生成...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await command.execute([testSpec.id, '--basic', '--no-risks'], app);

    // 4. 测试计划管理功能
    console.log('\n📊 测试计划管理功能...');
    const planManager = app.getContainer().get('plan');
    
    // 列出所有计划
    const plans = await planManager.list();
    console.log(`✅ 找到 ${plans.length} 个计划`);
    
    if (plans.length > 0) {
      const plan = plans[0];
      console.log(`📋 计划详情: ${plan.name}`);
      console.log(`   - 阶段数: ${plan.phases.length}`);
      console.log(`   - 任务数: ${plan.phases.reduce((sum, p) => sum + p.tasks.length, 0)}`);
      console.log(`   - 风险数: ${plan.risks.length}`);
      console.log(`   - 资源数: ${plan.resources.length}`);
      
      // 测试进度计算
      const progress = planManager.getProgress(plan);
      console.log(`   - 进度: ${progress.percentage}% (${progress.completedTasks}/${progress.totalTasks})`);
      
      // 测试Markdown导出
      const markdown = await planManager.exportToMarkdown(plan.id);
      if (markdown) {
        console.log(`   - Markdown导出: ${markdown.length} 字符`);
      }
    }

    console.log('\n✅ 所有测试完成！');
    console.log('\n🎉 实施计划生成功能验证成功！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testPlanGeneration().catch(console.error);
}

export { testPlanGeneration };