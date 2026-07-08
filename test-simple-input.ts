#!/usr/bin/env bun
/**
 * 简单输入测试 - 验证是否还有闪烁
 */

import React from 'react';
import { render, Box, Text } from 'ink';
import { SimpleInput } from './src/ui/components/SimpleInput';

function TestApp() {
  const handleSubmit = (value: string) => {
    console.log('Submitted:', value);
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} padding={1}>
        <Text>🧪 Simple Input Test - Type to check for flicker</Text>
      </Box>
      
      <SimpleInput
        onSubmit={handleSubmit}
        placeholder="Type here to test for flicker..."
        status="idle"
      />
    </Box>
  );
}

console.log('🧪 Testing SimpleInput component for flicker...');
console.log('📝 Type some characters and check if terminal flickers');
console.log('🔍 Expected: No flicker, smooth typing experience');
console.log('');

const { unmount } = render(<TestApp />);

process.on('SIGINT', () => {
  console.log('\n👋 Test completed');
  unmount();
  process.exit(0);
});