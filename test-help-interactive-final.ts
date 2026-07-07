#!/usr/bin/env npx tsx

/**
 * 交互式测试Help命令和输入框清空功能
 */

import React from 'react';
import { render } from 'ink';
import { Container } from './src/application/Container.js';
import { Application } from './src/application/Application.js';
import { App } from './src/ui/App.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';

async function testInteractiveHelp() {
  console.log('🧪 Starting Interactive Help Command Test');
  console.log('=' .repeat(60));
  console.log('Instructions:');
  console.log('1. Type "/help" and press Enter');
  console.log('2. Verify that the command list appears');
  console.log('3. Verify that the input box is cleared after pressing Enter');
  console.log('4. Type "/help clear" to test specific command help');
  console.log('5. Press Ctrl+C to exit');
  console.log('=' .repeat(60));
  console.log();

  try {
    // 创建容器和应用
    const container = new Container();
    const app = new Application(container);

    // 确保Help命令使用我们的简化版本
    const commandManager = app.getContainer().get('command');
    const helpCommand = new EnhancedHelpCommand();
    
    // 重新注册Help命令（覆盖默认的）
    commandManager.register(helpCommand);

    // 初始化应用
    await app.initialize();

    console.log('✅ Application initialized');
    console.log('✅ Enhanced Help Command registered');
    console.log();

    // 渲染UI
    const { unmount } = render(React.createElement(App, { app }));

    // 处理退出
    process.on('SIGINT', () => {
      console.log('\n👋 Exiting...');
      unmount();
      process.exit(0);
    });

    // 保持进程运行
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testInteractiveHelp().catch(console.error);