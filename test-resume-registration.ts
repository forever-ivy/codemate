#!/usr/bin/env node

/**
 * 测试Resume命令是否正确注册
 */

import { Application } from './src/application/Application';
import { Container } from './src/application/Container';

async function testResumeRegistration() {
  console.log('🧪 Testing Resume Command Registration...\n');
  
  try {
    // 1. 初始化应用
    const container = new Container();
    const app = new Application(container);
    
    // 2. 获取命令管理器
    const commandManager = app.getContainer().get('command');
    
    if (!commandManager) {
      console.error('❌ Command manager not found');
      return;
    }
    
    // 3. 检查resume命令是否存在
    const hasResume = commandManager.has('resume');
    console.log(`Resume command registered: ${hasResume ? '✅ YES' : '❌ NO'}`);
    
    // 4. 列出所有注册的命令
    const allCommands = commandManager.list();
    console.log(`\n📋 All registered commands (${allCommands.length}):`);
    allCommands.forEach(cmd => {
      console.log(`   - /${cmd}`);
    });
    
    // 5. 获取命令详细信息
    const commandsInfo = commandManager.getAllInfo();
    console.log('\n📝 Commands with descriptions:');
    commandsInfo.forEach(info => {
      console.log(`   /${info.name} - ${info.description}`);
      if (info.aliases.length > 0) {
        console.log(`     Aliases: ${info.aliases.map(a => `/${a}`).join(', ')}`);
      }
    });
    
    // 6. 特别检查resume命令
    const resumeCommand = commandManager.get('resume');
    if (resumeCommand) {
      console.log('\n✅ Resume command details:');
      console.log(`   Name: ${resumeCommand.name}`);
      console.log(`   Description: ${resumeCommand.description}`);
      console.log(`   Aliases: ${resumeCommand.aliases.join(', ') || 'None'}`);
    } else {
      console.log('\n❌ Resume command not found in registry');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  }
}

// 运行测试
testResumeRegistration();