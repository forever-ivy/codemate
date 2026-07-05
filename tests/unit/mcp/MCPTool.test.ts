import { describe, expect, it, vi } from 'vitest';
import { ToolManager } from '../../../src/managers/ToolManager';
import type { MCPClient } from '../../../src/mcp/MCPClient';
import { MCPTool } from '../../../src/mcp/MCPTool';
import type { MCPToolResult } from '../../../src/mcp/types';

describe('MCPTool', () => {
  it('should expose a stable namespaced tool contract', () => {
    const client = {
      callTool: vi.fn(),
    };

    const tool = new MCPTool(
      client as unknown as MCPClient,
      {
        name: 'echo-message',
        description: 'Echo back the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo',
            },
          },
          required: ['message'],
        },
      },
      'demo server'
    );

    expect(tool.name).toBe('mcp__demo_server__echo_message');
    expect(tool.description).toBe('[MCP:demo server] Echo back the input');
    expect(tool.metadata).toEqual({
      source: 'mcp',
      serverName: 'demo server',
      remoteToolName: 'echo-message',
    });
    expect(tool.validate({ message: 'hello' })).toEqual({ message: 'hello' });
  });

  it('should return standardized MCP output with raw content preserved', async () => {
    const rawResult: MCPToolResult = {
      content: [
        { type: 'text', text: 'first' },
        { type: 'image', data: 'base64-data' },
        { type: 'text', text: 'second' },
      ],
    };
    const client = {
      callTool: vi.fn(async () => rawResult),
    };

    const tool = new MCPTool(
      client as unknown as MCPClient,
      {
        name: 'echo',
        description: 'Echo back the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
      },
      'demo'
    );

    const result = await tool.execute({ message: 'hello' });

    expect(client.callTool).toHaveBeenCalledWith('echo', { message: 'hello' });
    expect(result).toEqual({
      success: true,
      source: 'mcp',
      serverName: 'demo',
      toolName: 'echo',
      content: 'first\nsecond',
      raw: rawResult,
    });
  });

  it('should expose MCP metadata through ToolManager schemas', () => {
    const toolManager = new ToolManager();
    const client = {
      callTool: vi.fn(),
    };
    const tool = new MCPTool(
      client as unknown as MCPClient,
      {
        name: 'echo',
        description: 'Echo back the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
      },
      'demo'
    );

    toolManager.register(tool);

    expect(toolManager.getToolSchemas()).toEqual([
      expect.objectContaining({
        name: 'mcp__demo__echo',
        metadata: {
          source: 'mcp',
          serverName: 'demo',
          remoteToolName: 'echo',
        },
      }),
    ]);
  });
});
