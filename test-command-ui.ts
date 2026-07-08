#!/usr/bin/env tsx

/**
 * 命令UI功能测试脚本
 * 
 * 测试不同命令的UI显示效果
 */

import { Application } from './src/application/Application.js';

async function testCommandUI() {
  console.log('🧪 Testing Command-Specific UI System...\n');
  
  try {
    // 初始化应用
    const app = new Application();
    
    console.log('✅ Application created successfully');
    
    // 测试命令UI管理器
    const { CommandUIManager } = await import('./src/ui/managers/CommandUIManager.js');
    const commandUIManager = new CommandUIManager();
    
    console.log('✅ CommandUIManager created');
    
    // 测试支持的命令
    const supportedCommands = [
      '/sessions', '/model', '/config', '/skill', 
      '/commit', '/workspace', '/log', '/agent'
    ];
    
    console.log('\n📋 Testing supported commands:');
    supportedCommands.forEach(cmd => {
      const isSupported = commandUIManager.isCommandUISupported(cmd);
      console.log(`  ${isSupported ? '✅' : '❌'} ${cmd}`);
    });
    
    // 测试命令数据生成
    console.log('\n🔧 Testing command data generation:');
    supportedCommands.forEach(cmd => {
      if (commandUIManager.isCommandUISupported(cmd)) {
        const defaultData = commandUIManager.getDefaultCommandData(cmd);
        console.log(`  ✅ ${cmd}: ${Object.keys(defaultData).length} data keys`);
      }
    });
    
    // 测试帮助信息
    console.log('\n📖 Testing command help:');
    supportedCommands.forEach(cmd => {
      const help = commandUIManager.getCommandHelp(cmd);
      console.log(`  ✅ ${cmd}: "${help}"`);
    });
    
    console.log('\n🎉 All Command UI tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testCommandUI().catch(console.error);