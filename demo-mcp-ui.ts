#!/usr/bin/env npx tsx

/**
 * MCP界面演示脚本
 * 
 * 直接演示MCP管理器界面的显示效果
 */

import React from 'react';
import { render, Box, Text } from 'ink';
import { MCPManager } from './src/ui/components/MCPManager';

// 模拟MCP管理器服务
const mockMCPManager = {
  getServerStatus: () => ({
    isReady: true,
    isLoading: false,
    servers: {
      'test-weather-server': {
        status: 'connected' as const,
        toolCount: 3,
        tools: ['get_weather', 'get_forecast', 'get_alerts'],
        error: undefined,
      },
      'test-file-server': {
        status: 'connecting' as const,
        toolCount: 0,
        tools: [],
        error: undefined,
      },
      'test-database-server': {
        status: 'failed' as const,
        toolCount: 0,
        tools: [],
        error: 'Connection timeout',
      },
    },
    configs: {
      'test-weather-server': {
        command: 'node',
        args: ['weather-server.js'],
        env: { API_KEY: 'test-key' },
      },
      'test-file-server': {
        command: 'python',
        args: ['file-server.py'],
        env: { DATA_PATH: '/tmp/data' },
      },
      'test-database-server': {
        command: 'uvx',
        args: ['database-mcp-server'],
        env: { DB_URL: 'sqlite:///test.db' },
      },
    },
  }),
  reconnectServer: async (serverName: string) => {
    console.log(`Reconnecting ${serverName}...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  },
};

// 模拟配置服务
const mockConfigService = {
  getGlobalConfigPath: () => '~/.aicli/mcp.json',
  getProjectConfigPath: () => './mcp.json',
};

// 演示组件
const MCPDemo: React.FC = () => {
  const [showDemo, setShowDemo] = React.useState(true);

  if (!showDemo) {
    return (
      <Box flexDirection="column">
        <Text>MCP界面演示结束</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">🚀 MCP命令交互式界面演示</Text>
      <Text></Text>
      <Text color="gray">用户输入: /mcp</Text>
      <Text color="gray">界面效果如下:</Text>
      <Text></Text>
      
      <MCPManager
        mcpManager={mockMCPManager as any}
        configService={mockConfigService as any}
        onExit={() => setShowDemo(false)}
      />
    </Box>
  );
};

console.log('🎯 启动MCP界面演示...\n');

// 渲染演示界面
render(<MCPDemo />);

// 添加说明
setTimeout(() => {
  console.log('\n📝 界面功能说明:');
  console.log('✅ 实时显示MCP服务器状态');
  console.log('🟢 绿色: 已连接服务器 (显示工具数量)');
  console.log('🟡 黄色: 连接中服务器 (显示加载动画)');
  console.log('🔴 红色: 连接失败服务器 (显示错误信息)');
  console.log('⌨️  键盘导航: ↑↓选择, Space展开工具, Enter重连, q退出');
  console.log('📍 显示配置文件路径: 全局和项目级别');
  console.log('🔄 自动刷新: 每3秒更新服务器状态');
}, 1000);