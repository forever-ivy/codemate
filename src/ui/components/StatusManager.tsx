import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { StatusDataCollector } from '../../services/StatusDataCollector.js';

interface StatusManagerProps {
  statusCollector: StatusDataCollector;
  onExit: () => void;
}

export const StatusManager: React.FC<StatusManagerProps> = ({ statusCollector, onExit }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const tabs = ['System', 'Sessions', 'Models', 'Health', 'Performance'];

  // 加载状态数据
  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await statusCollector.collectAllStatus();
      setStatusData(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和定时刷新
  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // 键盘输入处理
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onExit();
      return;
    }

    if (key.leftArrow && selectedTab > 0) {
      setSelectedTab(selectedTab - 1);
    }

    if (key.rightArrow && selectedTab < tabs.length - 1) {
      setSelectedTab(selectedTab + 1);
    }

    if (input === 'r') {
      loadStatus();
    }

    // 数字键切换标签
    const num = parseInt(input);
    if (num >= 1 && num <= tabs.length) {
      setSelectedTab(num - 1);
    }
  });

  if (loading && !statusData) {
    return (
      <Box flexDirection="column">
        <Text>
          <Spinner type="dots" /> Loading system status...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>System Status Dashboard</Text>
      <Text color="gray">Last updated: {lastUpdate.toLocaleTimeString()}</Text>
      <Text></Text>

      {/* 标签导航 */}
      <Box>
        {tabs.map((tab, index) => (
          <Box key={tab} marginRight={2}>
            <Text color={selectedTab === index ? 'cyan' : 'gray'}>
              {selectedTab === index ? '▶ ' : '  '}
              {index + 1}. {tab}
            </Text>
          </Box>
        ))}
      </Box>
      <Text></Text>

      {/* 内容区域 */}
      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        {selectedTab === 0 && <SystemTab data={statusData?.system} />}
        {selectedTab === 1 && <SessionsTab data={statusData?.sessions} />}
        {selectedTab === 2 && <ModelsTab data={statusData?.models} />}
        {selectedTab === 3 && <HealthTab data={statusData?.components} />}
        {selectedTab === 4 && <PerformanceTab data={statusData?.performance} />}
      </Box>

      <Text></Text>
      <Text color="gray">←→ Switch tabs • 1-5: Quick tab • r: Refresh • q/ESC: Exit</Text>
    </Box>
  );
};

// 系统信息标签
const SystemTab: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Text color="gray">No system data available</Text>;

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        System Information
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text>
          Platform: <Text color="green">{data.platform}</Text>
        </Text>
        <Text>
          Node.js: <Text color="green">{data.nodeVersion}</Text>
        </Text>
        <Text>
          Uptime: <Text color="green">{formatUptime(data.uptime)}</Text>
        </Text>
        <Text>
          CPU Cores: <Text color="green">{data.cpu.cores}</Text>
        </Text>
      </Box>

      <Text></Text>
      <Text bold color="cyan">
        Resource Usage
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text>
          Memory: <Text color="yellow">{formatBytes(data.memory.used)}</Text> /
          <Text color="green"> {formatBytes(data.memory.total)}</Text>
          <Text color="gray"> ({data.memory.percentage.toFixed(1)}%)</Text>
        </Text>

        <Text>
          CPU Usage:{' '}
          <Text color={data.cpu.usage > 80 ? 'red' : data.cpu.usage > 50 ? 'yellow' : 'green'}>
            {data.cpu.usage.toFixed(1)}%
          </Text>
        </Text>

        <Text>
          Load Average:{' '}
          <Text color="green">
            {data.loadAverage.map((load: number) => load.toFixed(2)).join(', ')}
          </Text>
        </Text>
      </Box>
    </Box>
  );
};

// 会话统计标签
const SessionsTab: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Text color="gray">No session data available</Text>;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Session Statistics
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text>
          Total Sessions: <Text color="green">{data.total}</Text>
        </Text>
        <Text>
          Active Sessions: <Text color="yellow">{data.active}</Text>
        </Text>
        <Text>
          Total Messages: <Text color="green">{data.totalMessages}</Text>
        </Text>
        <Text>
          Storage Used: <Text color="green">{data.storageUsed}</Text>
        </Text>
        <Text>
          Average Length: <Text color="green">{data.averageSessionLength} messages</Text>
        </Text>
        <Text>
          Recent Sessions (24h): <Text color="yellow">{data.recentSessions}</Text>
        </Text>
      </Box>

      {data.oldestSession && (
        <>
          <Text></Text>
          <Text bold color="cyan">
            Session Timeline
          </Text>
          <Text></Text>
          <Text>
            Oldest: <Text color="gray">{new Date(data.oldestSession).toLocaleString()}</Text>
          </Text>
          <Text>
            Newest: <Text color="gray">{new Date(data.newestSession).toLocaleString()}</Text>
          </Text>
        </>
      )}
    </Box>
  );
};

// 模型统计标签
const ModelsTab: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Text color="gray">No model data available</Text>;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Model Statistics
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text>
          Current Model: <Text color="green">{data.currentModel}</Text>
        </Text>
        <Text>
          Total Requests: <Text color="green">{data.totalRequests}</Text>
        </Text>
        <Text>
          Total Tokens: <Text color="green">{data.totalTokens.total}</Text>
        </Text>
        <Text>
          {' '}
          - Input: <Text color="yellow">{data.totalTokens.input}</Text>
        </Text>
        <Text>
          {' '}
          - Output: <Text color="yellow">{data.totalTokens.output}</Text>
        </Text>
        <Text>
          Estimated Cost: <Text color="green">${data.estimatedCost.toFixed(2)}</Text>
        </Text>
        <Text>
          Avg Response Time: <Text color="green">{data.averageResponseTime}ms</Text>
        </Text>
        <Text>
          Error Rate:{' '}
          <Text color={data.errorRate > 5 ? 'red' : 'green'}>{data.errorRate.toFixed(1)}%</Text>
        </Text>
      </Box>

      {data.popularModels.length > 0 && (
        <>
          <Text></Text>
          <Text bold color="cyan">
            Popular Models
          </Text>
          <Text></Text>
          {data.popularModels.map((model: any, index: number) => (
            <Text key={index}>
              {model.name}: <Text color="green">{model.usage} requests</Text>
              <Text color="gray"> ({model.percentage.toFixed(1)}%)</Text>
            </Text>
          ))}
        </>
      )}
    </Box>
  );
};

// 健康状态标签
const HealthTab: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Text color="gray">No health data available</Text>;

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'warning':
        return 'yellow';
      case 'error':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Component Health Status
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text>
          {getHealthIcon(data.overall)} Overall Status:
          <Text color={getHealthColor(data.overall)}> {data.overall.toUpperCase()}</Text>
        </Text>
        <Text></Text>

        <Text>
          {getHealthIcon(data.configService)} Config Service:
          <Text color={getHealthColor(data.configService)}> {data.configService}</Text>
        </Text>

        <Text>
          {getHealthIcon(data.mcpServers)} MCP Servers:
          <Text color={getHealthColor(data.mcpServers)}> {data.mcpServers}</Text>
        </Text>

        <Text>
          {getHealthIcon(data.eventBus)} Event Bus:
          <Text color={getHealthColor(data.eventBus)}> {data.eventBus}</Text>
        </Text>

        <Text>
          {getHealthIcon(data.sessionService)} Session Service:
          <Text color={getHealthColor(data.sessionService)}> {data.sessionService}</Text>
        </Text>

        <Text>
          {getHealthIcon(data.toolManager)} Tool Manager:
          <Text color={getHealthColor(data.toolManager)}> {data.toolManager}</Text>
        </Text>
      </Box>

      <Text></Text>
      <Text bold color="cyan">
        Health Summary
      </Text>
      <Text></Text>

      {data.overall === 'healthy' && (
        <Text color="green">🎉 All systems are running smoothly!</Text>
      )}

      {data.overall === 'warning' && (
        <Text color="yellow">
          ⚠️ Some components need attention, but core functionality is working.
        </Text>
      )}

      {data.overall === 'error' && (
        <Text color="red">🚨 Critical issues detected. Some features may not work properly.</Text>
      )}
    </Box>
  );
};

// 性能指标标签
const PerformanceTab: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Text color="gray">No performance data available</Text>;

  const renderTrend = (trend: number[], label: string) => {
    const max = Math.max(...trend);
    const min = Math.min(...trend);
    const range = max - min;

    return (
      <Box flexDirection="column">
        <Text>
          {label} Trend (last {trend.length} samples):
        </Text>
        <Box>
          {trend.slice(-20).map((value, index) => {
            const height = range > 0 ? Math.round(((value - min) / range) * 5) + 1 : 1;
            const bar = '█'.repeat(Math.max(1, height));
            return (
              <Text
                key={index}
                color={value > max * 0.8 ? 'red' : value > max * 0.6 ? 'yellow' : 'green'}
              >
                {bar}
              </Text>
            );
          })}
        </Box>
        <Text color="gray">
          Min: {min.toFixed(1)} | Max: {max.toFixed(1)} | Latest:{' '}
          {trend[trend.length - 1]?.toFixed(1) || 'N/A'}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        Performance Metrics
      </Text>
      <Text></Text>

      <Box flexDirection="column">
        <Text bold color="cyan">
          Response Times
        </Text>
        <Text>
          Average: <Text color="green">{data.responseTime.average.toFixed(0)}ms</Text>
        </Text>
        <Text>
          95th Percentile: <Text color="yellow">{data.responseTime.p95.toFixed(0)}ms</Text>
        </Text>
        <Text>
          99th Percentile: <Text color="red">{data.responseTime.p99.toFixed(0)}ms</Text>
        </Text>
      </Box>

      <Text></Text>
      <Box flexDirection="column">
        <Text bold color="cyan">
          Throughput
        </Text>
        <Text>
          Requests/sec: <Text color="green">{data.throughput.requestsPerSecond}</Text>
        </Text>
        <Text>
          Messages/min: <Text color="green">{data.throughput.messagesPerMinute}</Text>
        </Text>
      </Box>

      <Text></Text>
      <Box flexDirection="column">
        <Text bold color="cyan">
          Error Rates
        </Text>
        <Text>
          Total:{' '}
          <Text color={data.errorRates.total > 5 ? 'red' : 'green'}>
            {data.errorRates.total.toFixed(1)}%
          </Text>
        </Text>
        {Object.entries(data.errorRates.byType).map(([type, rate]: [string, any]) => (
          <Text key={type}>
            {' '}
            {type}: <Text color="yellow">{rate.toFixed(1)}%</Text>
          </Text>
        ))}
      </Box>

      <Text></Text>
      {data.resourceUsage.memoryTrend.length > 0 &&
        renderTrend(data.resourceUsage.memoryTrend, 'Memory Usage (%)')}

      <Text></Text>
      {data.resourceUsage.cpuTrend.length > 0 &&
        renderTrend(data.resourceUsage.cpuTrend, 'CPU Usage (%)')}
    </Box>
  );
};
