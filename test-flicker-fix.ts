#!/usr/bin/env bun
/**
 * 终端闪烁修复测试脚本
 * 
 * 测试优化后的App组件是否解决了闪烁问题
 */

import React from 'react';
import { render } from 'ink';
import { Box, Text, useInput } from 'ink';
import { Application } from './src/application/Application';
import { Container } from './src/application/Container';
import { SessionService } from './src/services/SessionService';
import { EventBus } from './src/services/EventBus';
import { ConfigService } from './src/services/ConfigService';
import { Paths } from './src/services/Paths';
import { AppV2 } from './src/ui/App.v2';

// 创建测试应用
async function createTestApp(): Promise<Application> {
  const container = new Container();
  
  const paths = new Paths({ productName: 'test-ai-cli', cwd: process.cwd() });
  const configService = new ConfigService({ 
    cwd: process.cwd(), 
    productName: 'test-ai-cli',
    argvConfig: {}
  });
  const eventBus = new EventBus();
  const sessionService = new SessionService(eventBus, paths);

  container.register('paths', paths);
  container.register('config', configService);
  container.register('eventBus', eventBus);
  container.register('session', sessionService);

  return new Application(container);
}

// 测试组件
function FlickerTest() {
  const [inputCount, setInputCount] = React.useState(0);
  const [app, setApp] = React.useState<Application | null>(null);

  React.useEffect(() => {
    createTestApp().then(setApp);
  }, []);

  // 模拟用户输入
  useInput((input, key) => {
    if (key.return) {
      setInputCount(prev => prev + 1);
    }
  });

  if (!app) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text>Loading test application...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* 测试说明 */}
      <Box paddingX={2} paddingY={1} borderBottom borderColor="cyan">
        <Box flexDirection="column">
          <Text bold color="cyan">
            🔧 Terminal Flicker Fix Test
          </Text>
          <Text color="gray">
            Press Enter to simulate input • Input count: {inputCount}
          </Text>
          <Text color="yellow">
            Watch for flickering - optimized version should be smooth
          </Text>
        </Box>
      </Box>

      {/* 使用优化的App组件 */}
      <Box flexGrow={1}>
        <AppV2 app={app} />
      </Box>

      {/* 测试状态 */}
      <Box paddingX={2} paddingY={1} borderTop borderColor="gray">
        <Text color="green">
          ✅ Using optimized App.v2.tsx with flicker prevention
        </Text>
      </Box>
    </Box>
  );
}

// 运行测试
console.log('🔧 Starting Terminal Flicker Fix Test...');
console.log('This test compares the optimized UI with flicker prevention');
console.log('Press Enter to simulate user input and watch for smooth rendering\n');

render(<FlickerTest />);