#!/usr/bin/env bun

/**
 * Spec 系统集成手动测试脚本
 * 
 * 用法：bun test-spec-system-manual.ts
 */

import { SpecSystemManager } from './src/spec/system/SpecSystemManager.js';
import { EventBus } from './src/services/EventBus.js';
import { ModelService } from './src/services/ModelService.js';
import { Paths } from './src/services/Paths.js';
import { Container } from './src/application/Container.js';
import type { CreateProjectOptions } from './src/spec/system/types.js';

async function main() {
  console.log('🧪 开始 Spec 系统集成测试');
  console.log('================================');

  try {
    // 1. 初始化服务
    console.log('\n📋 步骤 1: 初始化服务');
    const eventBus = new EventBus();
    const paths = new Paths({
      productName: 'aicli',
      cwd: process.cwd(),
    });
    
    // 创建容器并注册基础服务
    const container = new Container();
    container.register('eventBus', eventBus);
    container.register('paths', paths);
    
    const modelService = new ModelService({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: 'test-key',
      container,
      paths,
    });

    // 2. 创建系统管理器
    console.log('\n📋 步骤 2: 创建系统管理器');
    const systemManager = new SpecSystemManager(eventBus, modelService, paths);
    await systemManager.initialize();
    console.log('✅ 系统管理器初始化完成');

    // 3. 检查系统健康状态
    console.log('\n📋 步骤 3: 检查系统健康状态');
    const health = await systemManager.getSystemHealth();
    console.log(`📊 系统状态: ${health.status}`);
    console.log(`🔧 组件数量: ${health.components.size}`);
    console.log(`💾 内存使用: ${health.metrics.memoryUsage.toFixed(1)} MB`);
    console.log(`⚡ CPU 使用: ${health.metrics.cpuUsage.toFixed(1)}%`);

    // 4. 列出可用工作流
    console.log('\n📋 步骤 4: 列出可用工作流');
    const workflows = systemManager.getAvailableWorkflows();
    console.log(`🔄 可用工作流: ${workflows.length} 个`);
    for (const workflow of workflows) {
      console.log(`   - ${workflow.name} (${workflow.id}): ${workflow.steps.length} 步骤`);
    }

    // 5. 创建测试项目
    console.log('\n📋 步骤 5: 创建测试项目');
    const projectOptions: CreateProjectOptions = {
      name: '手动测试项目',
      description: '用于手动测试的示例项目',
      path: './test-project',
      type: 'web',
      techStack: ['TypeScript', 'React', 'Node.js'],
      teamSize: 'small',
      complexity: 'medium',
      initOptions: {
        autoStartBrainstorm: false,
        useDefaultTemplate: true,
        enableCache: true,
        enableMonitoring: true,
        notifications: {
          enabled: true,
          channels: ['console'],
          level: 'info',
          templates: new Map(),
        },
      },
    };

    const project = await systemManager.createProject(projectOptions);
    console.log(`✅ 项目创建成功: ${project.name} (${project.id})`);
    console.log(`📂 项目路径: ${project.path}`);
    console.log(`📊 项目状态: ${project.status}`);

    // 6. 更新项目状态
    console.log('\n📋 步骤 6: 更新项目状态');
    await systemManager.updateProjectStatus(project.id, 'brainstorming');
    const updatedProject = await systemManager.getProject(project.id);
    console.log(`✅ 状态更新成功: ${updatedProject?.status}`);

    // 7. 测试缓存功能
    console.log('\n📋 步骤 7: 测试缓存功能');
    const cacheService = systemManager.getCacheService();
    
    // 设置测试数据
    await cacheService.set('test-key-1', { data: 'test-value-1' });
    await cacheService.set('test-key-2', { data: 'test-value-2' });
    
    // 获取缓存统计
    const cacheStats = cacheService.getStatistics();
    console.log(`🗄️  缓存条目: ${cacheStats.totalEntries}`);
    console.log(`📊 命中率: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    
    // 测试缓存获取
    const cachedValue = await cacheService.get('test-key-1');
    console.log(`✅ 缓存获取成功: ${JSON.stringify(cachedValue)}`);

    // 8. 执行工作流（模拟）
    console.log('\n📋 步骤 8: 执行工作流（模拟）');
    try {
      const workflowResult = await systemManager.executeWorkflow('complete-project', { project });
      console.log(`✅ 工作流执行完成: ${workflowResult.status}`);
      console.log(`⏱️  执行时间: ${workflowResult.statistics.totalDuration}ms`);
      console.log(`📊 步骤统计: ${workflowResult.statistics.completedSteps}/${workflowResult.statistics.totalSteps}`);
    } catch (error) {
      console.log(`⚠️  工作流执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 9. 性能优化测试
    console.log('\n📋 步骤 9: 性能优化测试');
    const optimizationResults = await systemManager.optimizePerformance();
    console.log(`🔧 优化结果: ${optimizationResults.length} 项优化`);
    for (const result of optimizationResults) {
      console.log(`   - ${result.type}: 改进 ${result.improvement.toFixed(1)}%`);
    }

    // 10. 列出所有项目
    console.log('\n📋 步骤 10: 列出所有项目');
    const allProjects = await systemManager.listProjects();
    console.log(`📋 项目总数: ${allProjects.length}`);
    for (const proj of allProjects) {
      console.log(`   - ${proj.name} (${proj.id}): ${proj.status}`);
    }

    // 11. 系统监控测试
    console.log('\n📋 步骤 11: 系统监控测试');
    const finalHealth = await systemManager.getSystemHealth();
    console.log(`📊 最终系统状态: ${finalHealth.status}`);
    
    console.log('\n🎉 组件健康状态:');
    for (const [name, component] of finalHealth.components) {
      const statusIcon = component.status === 'healthy' ? '✅' : 
                        component.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${statusIcon} ${name}: ${component.message}`);
    }

    // 12. 清理和关闭
    console.log('\n📋 步骤 12: 清理和关闭');
    await systemManager.shutdown();
    console.log('✅ 系统已关闭');

    console.log('\n🎉 所有测试完成！');
    console.log('================================');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
main().catch(console.error);