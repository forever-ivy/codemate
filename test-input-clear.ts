#!/usr/bin/env npx tsx

/**
 * 测试输入框清空功能
 */

import React, { useState } from 'react';
import { render } from 'ink';
import { Box, Text } from 'ink';
import { EnhancedInput } from './src/ui/components/EnhancedInput.js';
import { ThemeProvider } from './src/ui/theme/ThemeSystem.js';

function TestInputClear() {
  const [lastSubmitted, setLastSubmitted] = useState<string>('');
  const [submitCount, setSubmitCount] = useState(0);

  const handleSubmit = (value: string) => {
    setLastSubmitted(value);
    setSubmitCount(prev => prev + 1);
    console.log(`✅ Submitted: "${value}"`);
  };

  return (
    <ThemeProvider>
      <Box flexDirection="column" padding={1}>
        <Text bold color="blue">🧪 Input Clear Test</Text>
        <Text>Type "/help" and press Enter to test input clearing</Text>
        <Text>Press Ctrl+C to exit</Text>
        <Text></Text>
        
        {submitCount > 0 && (
          <Box marginBottom={1}>
            <Text color="green">Last submitted: "{lastSubmitted}" (Count: {submitCount})</Text>
          </Box>
        )}

        <EnhancedInput
          onSubmit={handleSubmit}
          placeholder="Type /help and press Enter..."
          showSuggestions={false}
          showStatus={false}
        />
      </Box>
    </ThemeProvider>
  );
}

async function testInputClear() {
  console.log('🧪 Starting Input Clear Test');
  console.log('Instructions:');
  console.log('1. Type "/help" and press Enter');
  console.log('2. Check if the input box is cleared');
  console.log('3. Try typing again to verify it works');
  console.log('4. Press Ctrl+C to exit');
  console.log();

  const { unmount } = render(React.createElement(TestInputClear));

  // 处理退出
  process.on('SIGINT', () => {
    console.log('\n👋 Exiting...');
    unmount();
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});
}

// 运行测试
testInputClear().catch(console.error);