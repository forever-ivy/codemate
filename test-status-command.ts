#!/usr/bin/env tsx

/**
 * Status 命令测试脚本
 * 
 * 测试 /status 命令的完整功能
 */

import { Container } from './src/application/Container.js';
import { Application } from './src/application/Application.js';
import { StatusCommand } from './src/commands/system/StatusCommand.js';
import { StatusDataCollector } from './src/services/StatusDataCollector.js';
import { EventBus } from './src/services/EventBus.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';

async function testStatusCommand() {
  console.log('📊 Testing Status Command...\n');

  try {
    // 创建应用实例
    const app = new Application();
    const container = app.getContainer();
    const commandManager = container.get<SlashCommandManager>('command');
    
    console.log('✅ Application initialized');

    // 1. 检查 Status 命令是否注册
    console.log('\n📋 Checking Status command registration...');
    const commands = commandManager.list();
    const hasStatusCommand = commands.includes('status');
    console.log('Status command registered:', hasStatusCommand ? '✅' : '❌');
    
    if (!hasStatusCommand) {
      console.log('❌ Status command not found in registered commands');
      console.log('Available commands:', commands);
      return;
    }

    // 2. 获取 Status 命令实例
    const statusCommand = commandManager.get('status') as StatusCommand;
    console.log('Status command details:', {
      name: statusCommand.name,
      description: statusCommand.description,
      aliases: statusCommand.aliases,
    });

    // 3. 测试数据收集
    console.log('\n📊 Testing status data collection...');
    const statusData = await statusCommand.fetchData();
    console.log('Status data collected:', !!statusData);
    
    if (statusData) {
      console.log('Data structure:', {
        hasSystem: !!statusData.system,
        hasSessions: !!statusData.sessions,
        hasModels: !!statusData.models,
        hasComponents: !!statusData.components,
        hasPerformance: !!statusData.performance,
        timestamp: statusData.timestamp,
      });
    }

    // 4. 测试键盘快捷键
    console.log('\n⌨️  Testing keyboard shortcuts...');
    const shortcuts = statusCommand.getKeyboardShortcuts();
    console.log('Keyboard shortcuts:', shortcuts.length);
    shortcuts.forEach(shortcut => {
      console.log(`  ${shortcut.key}: ${shortcut.description} (${shortcut.category})`);
    });

    // 5. 测试元数据
    console.log('\n📝 Testing metadata...');
    const metadata = statusCommand.getMetadata();
    console.log('Metadata:', {
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      icon: metadata.icon,
      color: metadata.color,
      priority: metadata.priority,
    });

    // 6. 测试 UI 组件
    console.log('\n🎨 Testing UI component...');
    const UIComponent = statusCommand.getUIComponent();
    console.log('UI component available:', !!UIComponent);

    // 7. 测试命令执行（模拟）
    console.log('\n🚀 Testing command execution...');
    const eventBus = container.get<EventBus>('eventBus');
    
    // 监听事件
    let eventTriggered = false;
    eventBus.on('show_status_manager', (data) => {
      eventTriggered = true;
      console.log('✅ show_status_manager event triggered with data:', !!data.statusCollector);
    });

    // 执行命令
    await statusCommand.execute([], app);
    
    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Event triggered:', eventTriggered ? '✅' : '❌');

    console.log('\n✅ All Status Command tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.main) {
  testStatusCommand().catch(console.error);
}