import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { MCPManager as MCPManagerService } from '../../mcp/MCPManager';
import type { ConfigService } from '../../services/ConfigService';
import type { ServerStatus } from '../../mcp/MCPClient';

interface McpServerConfig {
  type?: string;
  command?: string;
  url?: string;
  disable?: boolean;
  [key: string]: any;
}

interface McpServerStatus {
  name: string;
  config: McpServerConfig;
  status: ServerStatus;
  error?: string;
  toolCount: number;
  tools: string[];
}

interface MCPManagerProps {
  mcpManager: MCPManagerService;
  configService: ConfigService;
  onExit: () => void;
}

export const MCPManager: React.FC<MCPManagerProps> = ({ mcpManager, configService, onExit }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [servers, setServers] = useState<McpServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [mcpStatus, setMcpStatus] = useState<{
    isReady: boolean;
    isLoading: boolean;
  }>({ isReady: false, isLoading: true });

  // 加载服务器状态
  const loadServers = () => {
    try {
      const status = mcpManager.getServerStatus();

      // 转换为服务器列表
      const serverList: McpServerStatus[] = Object.entries(status.servers).map(
        ([name, serverInfo]) => ({
          name,
          config: status.configs[name] || {},
          status: serverInfo.status,
          error: serverInfo.error,
          toolCount: serverInfo.toolCount,
          tools: serverInfo.tools,
        })
      );

      setServers(serverList);
      setMcpStatus({
        isReady: status.isReady,
        isLoading: status.isLoading,
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      setServers([]);
      setLoading(false);
    }
  };

  // 初始加载和定时刷新
  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 3000);
    return () => clearInterval(interval);
  }, []);

  // 键盘输入处理
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onExit();
      return;
    }

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }

    if (key.downArrow && selectedIndex < servers.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }

    if (input === ' ' && servers.length > 0) {
      const serverName = servers[selectedIndex].name;
      const newExpanded = new Set(expandedServers);
      if (newExpanded.has(serverName)) {
        newExpanded.delete(serverName);
      } else {
        newExpanded.add(serverName);
      }
      setExpandedServers(newExpanded);
    }

    if (key.return && servers.length > 0) {
      const server = servers[selectedIndex];
      if (server.status === 'failed' || server.status === 'disconnected') {
        handleReconnect(server.name);
      }
    }
  });

  // 重新连接服务器
  const handleReconnect = async (serverName: string) => {
    setReconnecting(serverName);
    try {
      await mcpManager.reconnectServer(serverName);
      loadServers();
    } catch (error) {
      console.error(`Failed to reconnect: ${error}`);
    } finally {
      setReconnecting(null);
    }
  };
  // 渲染状态指示器
  const getStatusIndicator = (status: ServerStatus) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'pending':
        return '🟡';
      case 'failed':
        return '🔴';
      case 'disconnected':
        return '🔴';
      default:
        return '⚪';
    }
  };

  // 渲染状态文本
  const getStatusText = (server: McpServerStatus) => {
    if (reconnecting === server.name) {
      return (
        <Text>
          <Spinner type="dots" /> <Text color="yellow">reconnecting...</Text>
        </Text>
      );
    }

    switch (server.status) {
      case 'connected':
        return <Text color="green">connected · {server.toolCount} tools</Text>;
      case 'connecting':
        return (
          <Text>
            <Spinner type="dots" /> <Text color="yellow">connecting...</Text>
          </Text>
        );
      case 'pending':
        return (
          <Text>
            <Spinner type="dots" /> <Text color="yellow">pending...</Text>
          </Text>
        );
      case 'failed':
        return (
          <Text color="red">
            failed · {server.error || 'Unknown error'} · <Text color="cyan">Enter</Text> to retry
          </Text>
        );
      case 'disconnected':
        return (
          <Text color="red">
            disconnected · <Text color="cyan">Enter</Text> to reconnect
          </Text>
        );
      default:
        return <Text color="gray">unknown</Text>;
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text>
          <Spinner type="dots" /> Loading MCP servers...
        </Text>
      </Box>
    );
  }

  if (servers.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Manage MCP servers</Text>
        <Text></Text>
        <Text color="gray">No MCP servers configured.</Text>
        <Text></Text>
        <Text color="gray">Press 'q' or ESC to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Manage MCP servers</Text>
      <Text></Text>

      {/* MCP Manager Status */}
      <Box marginBottom={1}>
        <Text color="gray">MCP Manager: </Text>
        {mcpStatus.isLoading ? (
          <Text>
            <Spinner type="dots" /> <Text color="yellow">Initializing...</Text>
          </Text>
        ) : mcpStatus.isReady ? (
          <Text color="green">Ready</Text>
        ) : (
          <Text color="red">Not Ready</Text>
        )}
      </Box>

      <Box borderStyle="round" borderColor="gray" flexDirection="column" padding={1}>
        {servers.map((server, index) => {
          const isSelected = index === selectedIndex;
          const isExpanded = expandedServers.has(server.name);

          return (
            <Box key={server.name} flexDirection="column">
              <Box>
                <Text color={isSelected ? 'cyan' : undefined}>
                  {`${index + 1}. ${server.name} `}
                </Text>
                <Text>{getStatusIndicator(server.status)} </Text>
                {getStatusText(server)}
              </Box>

              {isExpanded && (
                <Box marginLeft={4} flexDirection="column">
                  {server.status === 'connected' && server.tools.length > 0 ? (
                    <>
                      <Text color="gray">Tools ({server.toolCount}):</Text>
                      {server.tools.map((tool) => (
                        <Text key={tool} color="gray">
                          • {tool}
                        </Text>
                      ))}
                    </>
                  ) : server.status === 'connected' && server.toolCount === 0 ? (
                    <Text color="gray">No tools available</Text>
                  ) : (
                    <Box flexDirection="column">
                      <Text color="gray">Server configuration:</Text>
                      {server.config.command && (
                        <Text color="gray">• Command: {server.config.command}</Text>
                      )}
                      {server.config.url && <Text color="gray">• URL: {server.config.url}</Text>}
                      {server.config.type && <Text color="gray">• Type: {server.config.type}</Text>}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <Text></Text>
      <Text color="gray">MCP Config locations (by scope):</Text>
      <Text color="gray">• User config (available in all your projects):</Text>
      <Text color="gray"> {configService.getGlobalConfigPath()}</Text>
      <Text color="gray">• Project config:</Text>
      <Text color="gray"> {configService.getProjectConfigPath()}</Text>
      <Text color="gray">↑↓ Navigate • Space: Toggle tools • Enter: Reconnect • q/ESC: Exit</Text>
    </Box>
  );
};
