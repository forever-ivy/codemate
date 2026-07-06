import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MCPManager } from '../../../src/ui/components/MCPManager';

// Mock MCPManager service
const mockMcpManager = {
  getServerStatus: vi.fn(() => ({
    isReady: true,
    isLoading: false,
    servers: {
      'test-server': {
        status: 'connected' as const,
        toolCount: 5,
        tools: ['tool1', 'tool2', 'tool3', 'tool4', 'tool5'],
      },
      'failed-server': {
        status: 'failed' as const,
        error: 'Connection timeout',
        toolCount: 0,
        tools: [],
      },
    },
    configs: {
      'test-server': {
        command: 'node',
        args: ['server.js'],
      },
      'failed-server': {
        command: 'python',
        args: ['server.py'],
      },
    },
  })),
  reconnectServer: vi.fn(),
};

// Mock ConfigService
const mockConfigService = {
  getGlobalConfigPath: vi.fn(() => '~/.aicli/config.json'),
  getProjectConfigPath: vi.fn(() => './.aicli/config.json'),
};

describe('MCPManager', () => {
  it('should render server list correctly', async () => {
    const { lastFrame } = render(
      <MCPManager
        mcpManager={mockMcpManager as any}
        configService={mockConfigService as any}
        onExit={() => {}}
      />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Manage MCP servers');
    });

    const output = lastFrame() ?? '';
    expect(output).toContain('Manage MCP servers');
    expect(output).toContain('test-server');
    expect(output).toContain('failed-server');
    expect(output).toContain('connected');
    expect(output).toContain('5 tools');
    expect(output).toContain('failed');
  });

  it('should show loading state initially', () => {
    // Mock loading state
    const loadingMcpManager = {
      ...mockMcpManager,
      getServerStatus: vi.fn(() => {
        throw new Error('Loading...');
      }),
    };

    const { lastFrame } = render(
      <MCPManager
        mcpManager={loadingMcpManager as any}
        configService={mockConfigService as any}
        onExit={() => {}}
      />
    );

    const output = lastFrame() ?? '';
    expect(output).toContain('Loading MCP servers');
  });

  it('should show empty state when no servers configured', async () => {
    const emptyMcpManager = {
      ...mockMcpManager,
      getServerStatus: vi.fn(() => ({
        isReady: false,
        isLoading: false,
        servers: {},
        configs: {},
      })),
    };

    const { lastFrame } = render(
      <MCPManager
        mcpManager={emptyMcpManager as any}
        configService={mockConfigService as any}
        onExit={() => {}}
      />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No MCP servers configured');
    });

    const output = lastFrame() ?? '';
    expect(output).toContain('No MCP servers configured');
  });

  it('should display config paths', async () => {
    const { lastFrame } = render(
      <MCPManager
        mcpManager={mockMcpManager as any}
        configService={mockConfigService as any}
        onExit={() => {}}
      />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Manage MCP servers');
    });

    const output = lastFrame() ?? '';
    expect(output).toContain('~/.aicli/config.json');
    expect(output).toContain('./.aicli/config.json');
  });

  it('should show keyboard shortcuts', async () => {
    const { lastFrame } = render(
      <MCPManager
        mcpManager={mockMcpManager as any}
        configService={mockConfigService as any}
        onExit={() => {}}
      />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Manage MCP servers');
    });

    const output = lastFrame() ?? '';
    expect(output).toContain('↑↓ Navigate');
    expect(output).toContain('Space: Toggle tools');
    expect(output).toContain('Enter: Reconnect');
    expect(output).toContain('q/ESC: Exit');
  });
});
