#!/usr/bin/env bun

/**
 * 调试Rewind命令的测试脚本
 */

import { Application } from './src/application/Application';

async function testRewindCommand() {
  console.log('🔍 Testing Rewind Command Debug...\n');

  try {
    // 1. 初始化应用
    console.log('1️⃣  Initializing application...');
    const app = new Application();
    await app.start();
    console.log('✅ Application initialized\n');

    // 2. 检查命令是否注册
    console.log('2️⃣  Checking command registration...');
    const commandManager = app.getContainer().get('command') as any;
    
    if (commandManager) {
      const commands = commandManager.list();
      console.log('📋 Registered commands:', commands);
      
      // 检查rewind命令
      const rewindCommand = commandManager.get('rewind');
      if (rewindCommand) {
        console.log('✅ RewindCommand found:', {
          name: rewindCommand.name,
          description: rewindCommand.description,
          aliases: rewindCommand.aliases
        });
      } else {
        console.log('❌ RewindCommand not found');
      }
    } else {
      console.log('❌ CommandManager not found');
    }

    // 3. 检查EventBus
    console.log('\n3️⃣  Checking EventBus...');
    const eventBus = app.getContainer().get('eventBus') as any;
    if (eventBus) {
      console.log('✅ EventBus found');
      
      // 监听rewind事件
      eventBus.on('show_rewind_selector', () => {
        console.log('🎉 show_rewind_selector event received!');
      });
    } else {
      console.log('❌ EventBus not found');
    }

    // 4. 测试命令执行
    console.log('\n4️⃣  Testing command execution...');
    if (commandManager && commandManager.get('rewind')) {
      try {
        await commandManager.execute('/rewind', app);
        console.log('✅ Command executed successfully');
      } catch (error) {
        console.log('❌ Command execution failed:', error);
      }
    }

    // 5. 测试别名
    console.log('\n5️⃣  Testing command alias...');
    if (commandManager) {
      try {
        await commandManager.execute('/rw', app);
        console.log('✅ Alias executed successfully');
      } catch (error) {
        console.log('❌ Alias execution failed:', error);
      }
    }

    console.log('\n✅ Debug test completed!');

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testRewindCommand().catch(console.error);
}