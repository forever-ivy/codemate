#!/usr/bin/env bun
/**
 * 终极闪烁测试脚本
 * 
 * 测试输入时是否还有闪烁问题
 */

import React from 'react';
import { render } from 'ink';
import { Container } from './src/application/Container';
import { Application } from './src/application/Application';
import { App } from './src/ui/App';

async function testFlickerFix() {
  console.log('🧪 Testing flicker fix...');
  
  try {
    // 创建容器和应用
    const container = new Container();
    await container.initialize();
    
    const app = new Application(container);
    await app.initialize();
    
    console.log('✅ Application initialized');
    console.log('📝 Instructions:');
    console.log('   1. Type some characters slowly');
    console.log('   2. Check if the terminal flickers on each keystroke');
    console.log('   3. Try typing "/" to see command suggestions');
    console.log('   4. Press Ctrl+C to exit');
    console.log('');
    console.log('🔍 Expected behavior:');
    console.log('   - No flicker when typing');
    console.log('   - Smooth input experience like');
    console.log('   - Stable UI components');
    console.log('');
    
    // 渲染应用
    const { unmount } = render(<App app={app} />);
    
    // 处理退出
    process.on('SIGINT', () => {
      console.log('\n👋 Exiting flicker test...');
      unmount();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testFlickerFix();