#!/usr/bin/env node

/**
 * 测试Help命令的行为
 */

import { Application } from './src/application/Application.js';

async function testHelpCommand() {
  console.log('🧪 Testing Help Command Behavior...\n');

  try {
    // 1. 创建应用实例
    const app = new Application();
    await app.start();

    // 2. 获取命令管理器
    const commandManager = app.getContainer().get('command');
    
    // 3. 检查注册的命令
    console.log('📋 Registered Commands:');
    const commands = commandManager.getAllInfo();
    commands.forEach(cmd => {
      console.log(`  - ${cmd.name}: ${cmd.description}`);
    });
    console.log('');

    // 4. 检查help命令的类型
    const helpCommand = commandManager.get('help');
    console.log('🔍 Help Command Info:');
    console.log(`  - Name: ${helpCommand?.name}`);
    console.log(`  - Constructor: ${helpCommand?.constructor.name}`);
    console.log(`  - Description: ${helpCommand?.description}`);
    console.log('');

    // 5. 检查CommandUIManager是否正确注册
    const commandUIManager = app.getContainer().get('commandUI');
    console.log('🎨 CommandUIManager Info:');
    console.log(`  - Registered: ${commandUIManager ? '✅' : '❌'}`);
    console.log(`  - Constructor: ${commandUIManager?.constructor.name || 'N/A'}`);
    console.log('');

    // 6. 测试执行help命令（不带参数，应该使用增强UI）
    console.log('🚀 Testing /help command (no args - should use enhanced UI):');
    console.log('----------------------------------------');
    try {
      await helpCommand?.execute([], app);
      console.log('✅ Help command executed successfully');
    } catch (error) {
      console.error('❌ Help command failed:', error.message);
    }
    console.log('----------------------------------------');

    // 7. 测试执行help命令（带参数，应该显示特定命令帮助）
    console.log('\n🚀 Testing /help model (with args - should show specific help):');
    console.log('----------------------------------------');
    try {
      await helpCommand?.execute(['model'], app);
      console.log('✅ Help model command executed successfully');
    } catch (error) {
      console.error('❌ Help model command failed:', error.message);
    }
    console.log('----------------------------------------');

    await app.stop();

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// 运行测试
testHelpCommand();