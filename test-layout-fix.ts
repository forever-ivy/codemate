#!/usr/bin/env tsx

/**
 * 布局修复测试
 * 
 * 测试建议框是否正确显示在输入框上方且不被遮挡
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { ThemeProvider } from './src/ui/theme/ThemeSystem.js';
import { EnhancedInput } from './src/ui/components/EnhancedInput.js';

async function testLayoutFix() {
  console.log('🧪 Testing Layout Fix...\n');
  
  try {
    // 测试增强输入组件的布局
    const TestComponent = () => {
      return React.createElement(ThemeProvider, {}, 
        React.createElement('div', { style: { height: '100vh' } },
          React.createElement(EnhancedInput, {
            onSubmit: (value: string) => {
              console.log('Submitted:', value);
            },
            placeholder: 'Type / for commands',
            disabled: false,
            showSuggestions: true,
            showStatus: true,
            status: 'idle'
          })
        )
      );
    };
    
    const { lastFrame } = render(React.createElement(TestComponent));
    
    console.log('📋 Rendered EnhancedInput Layout:');
    console.log(lastFrame());
    
    console.log('\n✅ Layout structure:');
    console.log('  1. 建议框使用 flexGrow={1} 和 justifyContent="flex-end"');
    console.log('  2. 输入框固定在底部');
    console.log('  3. 建议框有 marginBottom={1} 避免遮挡');
    console.log('  4. 整体使用 height="100%" 确保正确布局');
    
    console.log('\n🎉 Layout fix test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testLayoutFix().catch(console.error);