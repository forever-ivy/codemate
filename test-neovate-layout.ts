#!/usr/bin/env node
/**
 * 
 * 验证：
 * 1. 输入框显示在固定位置
 * 2. 命令列表显示在输入框下方
 * 3. 命令列表不滚动，固定显示10个命令
 * 4. 支持上下键选择命令
 */

import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Command {
  name: string;
  description: string;
}

const COMMANDS: Command[] = [
  { name: '/help', description: 'Show available slash commands and usage' },
  { name: '/clear', description: 'Start a new session' },
  { name: '/exit', description: 'Exit the application' },
  { name: '/sessions', description: 'Manage and switch between sessions' },
  { name: '/model', description: 'Select a model' },
  { name: '/config', description: 'Application settings and configuration' },
  { name: '/commit', description: 'Smart git commit with AI-generated messages' },
  { name: '/workspace', description: 'Workspace management and git worktree operations' },
  { name: '/log', description: 'View session logs in HTML format' },
  { name: '/skill', description: 'Manage skills and custom commands' },
  { name: '/agent', description: 'Agent operations and subagent management' },
  { name: '/fork', description: 'Fork current conversation at any point' },
  { name: '/rewind', description: 'Rewind to previous conversation state' },
];

function NeovateLayoutTest() {
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommands, setShowCommands] = useState(false);

  // 监听输入变化
  React.useEffect(() => {
    setShowCommands(input === '/');
    if (input === '/') {
      setSelectedIndex(0);
    }
  }, [input]);

  // 键盘处理
  useInput((_, key) => {
    if (!showCommands) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(COMMANDS.length - 1, prev + 1));
    } else if (key.return) {
      setInput(COMMANDS[selectedIndex].name);
      setShowCommands(false);
    } else if (key.escape) {
      setShowCommands(false);
    }
  });

  const handleSubmit = (value: string) => {
    console.log('Submitted:', value);
    setInput('');
    setShowCommands(false);
  };

  // 限制显示10个命令
  const maxVisible = 10;
  const visibleCommands = COMMANDS.slice(0, maxVisible);

  return (
    <Box flexDirection="column">
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          cc Layout Test
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Type "/" to show commands, use ↑↓ to navigate, Enter to select
        </Text>
      </Box>

      {/* 输入区域 */}
      <Box flexDirection="column">
        {/* 分隔线 */}
        <Text color="gray">{'─'.repeat(80)}</Text>

        {/* 输入框 */}
        <Box flexDirection="row">
          <Text color="green" bold>
            {'>'}
            {' '}
          </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Type your message or / for commands..."
          />
        </Box>

        {/* 分隔线 */}
        <Text color="gray">{'─'.repeat(80)}</Text>
      </Box>

      {/* 命令列表 - 显示在输入框下方 */}
      {showCommands && (
        <Box flexDirection="column" marginLeft={2}>
          {visibleCommands.map((cmd, index) => (
            <Box key={index} flexDirection="row">
              {/* 命令名 */}
              <Box width={20}>
                <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
                  {cmd.name}
                </Text>
              </Box>

              {/* 描述 */}
              <Text color="dim" dimColor>
                {cmd.description}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* 状态信息 */}
      <Box marginTop={1}>
        <Text dimColor>
          Input: "{input}" | Selected: {selectedIndex} | Show: {showCommands ? 'Yes' : 'No'}
        </Text>
      </Box>
    </Box>
  );
}

// 运行测试
const { unmount } = render(<NeovateLayoutTest />);

// 10秒后自动退出
setTimeout(() => {
  unmount();
  console.log('\n✅ Layout test completed');
  process.exit(0);
}, 30000);
