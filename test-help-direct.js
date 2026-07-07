#!/usr/bin/env node

/**
 * 直接测试Help命令的execute方法
 */

async function testHelpDirect() {
  console.log('🧪 Testing Help Command Execute Method...\n');

  try {
    // 动态导入模块
    const { Application } = await import('./dist/cli.js');
    
    // 创建应用实例
    const app = new Application();
    await app.start();

    // 获取命令管理器和help命令
    const commandManager = app.getContainer().get('command');
    const helpCommand = commandManager.get('help');

    console.log('🔍 Help Command Info:');
    console.log(`  - Name: ${helpCommand?.name}`);
    console.log(`  - Constructor: ${helpCommand?.constructor.name}`);
    console.log(`  - Description: ${helpCommand?.description}`);
    console.log('');

    // 测试执行help命令（无参数）
    console.log('🚀 Executing /help (no args):');
    console.log('----------------------------------------');
    await helpCommand?.execute([], app);
    console.log('----------------------------------------\n');

    // 测试执行help命令（带参数）
    console.log('🚀 Executing /help model:');
    console.log('----------------------------------------');
    await helpCommand?.execute(['model'], app);
    console.log('----------------------------------------\n');

    // 测试不存在的命令
    console.log('🚀 Executing /help nonexistent:');
    console.log('----------------------------------------');
    await helpCommand?.execute(['nonexistent'], app);
    console.log('----------------------------------------\n');

    await app.stop();
    console.log('✅ All tests completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testHelpDirect();