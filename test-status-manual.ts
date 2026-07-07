#!/usr/bin/env bun

/**
 * Status命令手动测试脚本
 * 
 * 测试Status命令的各种功能：
 * 1. 基本命令执行
 * 2. 系统信息收集
 * 3. 会话统计
 * 4. 模型统计
 * 5. 组件健康检查
 * 6. 性能指标
 * 7. 交互式界面
 */

import { Application } from './src/application/Application.js';
import { ConfigService } from './src/services/ConfigService.js';
import { ConfigManager } from './src/config/ConfigManager.js';
import type { ModelConfig } from './src/types/index.js';

async function testStatusCommand() {
  console.log('🧪 Testing Status Command...\n');

  try {
    // 1. 创建应用实例
    const modelConfig: ModelConfig = {
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || 'test-key',
      baseURL: 'https://api.deepseek.com',
    };

    const configManager = new ConfigManager({
      cwd: process.cwd(),
      productName: 'aicli',
    });

    const configService = new ConfigService(configManager);
    const app = new Application(modelConfig, configService, configManager);

    // 2. 启动应用
    await app.start();

    // 3. 获取服务
    const container = app.getContainer();
    const commandManager = container.get('command');
    const statusCollector = container.get('statusCollector');
    const eventBus = container.get('eventBus');

    console.log('✅ Application started successfully');

    // 4. 测试StatusDataCollector
    console.log('\n📊 Testing StatusDataCollector...');
    
    const systemInfo = await statusCollector.collectSystemInfo();
    console.log('System Info:', {
      platform: systemInfo.platform,
      nodeVersion: systemInfo.nodeVersion,
      memoryUsage: `${systemInfo.memory.percentage.toFixed(1)}%`,
      cpuCores: systemInfo.cpu.cores,
      uptime: `${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor((systemInfo.uptime % 3600) / 60)}m`,
    });

    const sessionStats = await statusCollector.collectSessionStats();
    console.log('Session Stats:', {
      total: sessionStats.total,
      active: sessionStats.active,
      totalMessages: sessionStats.totalMessages,
      storageUsed: sessionStats.storageUsed,
    });

    const modelStats = await statusCollector.collectModelStats();
    console.log('Model Stats:', {
      currentModel: modelStats.currentModel,
      totalRequests: modelStats.totalRequests,
      totalTokens: modelStats.totalTokens.total,
    });

    const componentHealth = await statusCollector.checkComponentHealth();
    console.log('Component Health:', {
      overall: componentHealth.overall,
      configService: componentHealth.configService,
      mcpServers: componentHealth.mcpServers,
      sessionService: componentHealth.sessionService,
    });

    const performanceMetrics = await statusCollector.collectPerformanceMetrics();
    console.log('Performance Metrics:', {
      avgResponseTime: performanceMetrics.responseTime.average,
      requestsPerSecond: performanceMetrics.throughput.requestsPerSecond,
      errorRate: performanceMetrics.errorRates.total,
    });

    // 5. 测试完整状态收集
    console.log('\n🔄 Testing complete status collection...');
    const allStatus = await statusCollector.collectAllStatus();
    console.log('Complete Status collected at:', allStatus.timestamp);

    // 6. 测试Status命令注册
    console.log('\n📋 Testing Status command registration...');
    const commands = commandManager.list();
    const hasStatusCommand = commands.includes('status');
    console.log('Status command registered:', hasStatusCommand ? '✅' : '❌');

    if (hasStatusCommand) {
      const statusCommand = commandManager.get('status');
      console.log('Status command details:', {
        name: statusCommand.name,
        description: statusCommand.description,
        aliases: statusCommand.aliases,
      });
    }

    // 7. 测试事件系统
    console.log('\n🎯 Testing event system...');
    let eventReceived = false;
    
    const testEventHandler = () => {
      eventReceived = true;
      console.log('✅ show_status_manager event received');
    };

    eventBus.on('show_status_manager', testEventHandler);
    eventBus.emit('show_status_manager', {});
    
    setTimeout(() => {
      eventBus.off('show_status_manager', testEventHandler);
      console.log('Event handling test:', eventReceived ? '✅' : '❌');
    }, 100);

    // 8. 测试性能历史记录
    console.log('\n📈 Testing performance history...');
    statusCollector.recordResponseTime(150);
    statusCollector.recordResponseTime(200);
    statusCollector.recordResponseTime(120);
    
    const updatedMetrics = await statusCollector.collectPerformanceMetrics();
    console.log('Performance history updated:', updatedMetrics.responseTime.average > 0 ? '✅' : '❌');

    // 9. 停止应用
    await app.stop();
    console.log('\n✅ All Status command tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.main) {
  testStatusCommand().catch(console.error);
}