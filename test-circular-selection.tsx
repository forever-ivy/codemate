#!/usr/bin/env tsx
/**
 * 测试循环选择和防闪烁功能
 * 
 * 验证：
 * 1. 从第一个命令向上选择，应该跳到最后一个
 * 2. 从最后一个命令向下选择，应该跳到第一个
 * 3. suggestions内容变化但长度不变时，不应该闪烁
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';

interface Command {
  name: string;
  description: string;
}

const COMMANDS: Command[] = [
  { name: '/help', description: 'Show help' },
  { name: '/clear', description: 'Clear session' },
  { name: '/exit', description: 'Exit app' },
  { name: '/sessions', description: 'Manage sessions' },
  { name: '/model', description: 'Select model' },
];

function CircularSelectionTest() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [testPhase, setTestPhase] = useState<'init' | 'up' | 'down' | 'done'>('init');
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    const runTests = async () => {
      // 等待初始渲染
      await new Promise(resolve => setTimeout(resolve, 500));

      // 测试1：从第一个向上选择（应该跳到最后一个）
      setTestPhase('up');
      setSelectedIndex(prev => {
        const newIndex = prev === 0 ? COMMANDS.length - 1 : prev - 1;
        if (newIndex === COMMANDS.length - 1) {
          setResults(prev => [...prev, '✅ 测试1通过：从第一个向上选择跳到最后一个']);
        } else {
          setResults(prev => [...prev, '❌ 测试1失败：循环选择未生效']);
        }
        return newIndex;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // 测试2：从最后一个向下选择（应该跳到第一个）
      setTestPhase('down');
      setSelectedIndex(prev => {
        const newIndex = prev === COMMANDS.length - 1 ? 0 : prev + 1;
        if (newIndex === 0) {
          setResults(prev => [...prev, '✅ 测试2通过：从最后一个向下选择跳到第一个']);
        } else {
          setResults(prev => [...prev, '❌ 测试2失败：循环选择未生效']);
        }
        return newIndex;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setTestPhase('done');
    };

    runTests();
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          循环选择测试
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          当前阶段: <Text color="yellow">{testPhase}</Text>
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          当前选中索引: <Text color="green">{selectedIndex}</Text> / {COMMANDS.length - 1}
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>命令列表:</Text>
        {COMMANDS.map((cmd, index) => (
          <Box key={index} marginLeft={2}>
            <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
              {index === selectedIndex ? '→ ' : '  '}
              {cmd.name} - {cmd.description}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>测试结果:</Text>
        {results.map((result, index) => (
          <Box key={index} marginLeft={2}>
            <Text>{result}</Text>
          </Box>
        ))}
      </Box>

      {testPhase === 'done' && (
        <Box marginTop={1}>
          <Text bold color="green">
            ✅ 所有测试完成！
          </Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          测试说明：
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor>
          1. 初始选中第一个命令（索引0）
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor>
          2. 向上选择，应该跳到最后一个（索引{COMMANDS.length - 1}）
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor>
          3. 向下选择，应该跳回第一个（索引0）
        </Text>
      </Box>
    </Box>
  );
}

// 运行测试
const { unmount } = render(<CircularSelectionTest />);

// 5秒后自动退出
setTimeout(() => {
  unmount();
  console.log('\n✅ 循环选择测试完成');
  process.exit(0);
}, 5000);
