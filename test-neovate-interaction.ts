#!/usr/bin/env tsx

/**
 * ccc
 * 
 * 测试输入"/"时的命令列表显示和键盘导航
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { ThemeProvider } from './src/ui/theme/ThemeSystem.js';
import { SuggestionBox, SuggestionEngine } from './src/ui/components/SuggestionBox.js';

async function testNeovateInteraction() {
  console.log('🧪 Testing cc-style Interaction...\n');
  
  try {
    // 创建建议引擎
    const suggestionEngine = new SuggestionEngine();
    
    // 测试获取"/"的建议
    const suggestions = await suggestionEngine.getSuggestions('/');
    
    console.log('✅ Suggestions for "/":', suggestions.length, 'commands');
    suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion.text} - ${suggestion.description}`);
    });
    
    // 测试建议框组件
    const TestComponent = () => {
      return React.createElement(ThemeProvider, {}, 
        React.createElement(SuggestionBox, {
          suggestions: suggestions,
          onSelect: (suggestion: any) => {
            console.log('Selected:', suggestion.text);
          },
          onCancel: () => {
            console.log('Cancelled');
          },
          visible: true,
          fullCommandList: true
        })
      );
    };
    
    const { lastFrame } = render(React.createElement(TestComponent));
    
    console.log('\n📋 Rendered SuggestionBox:');
    console.log(lastFrame());
    
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testNeovateInteraction().catch(console.error);