import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPClient } from '../../../src/mcp/MCPClient';
import * as path from 'node:path';

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(async () => {
    // 使用 Mock MCP 服务器
    const mockServerPath = path.join(__dirname, '../../mocks/mock-mcp-server.ts');

    client = new MCPClient('test', {
      command: 'npx',
      args: ['tsx', mockServerPath],
      env: {},
    });

    await client.connect();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  it('should discover tools', async () => {
    const tools = await client.listTools();

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('echo');
    expect(tools[1].name).toBe('add');
  });

  it('should call echo tool', async () => {
    const result = await client.callTool('echo', {
      message: 'Hello, MCP!',
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe('Echo: Hello, MCP!');
  });

  it('should call add tool', async () => {
    const result = await client.callTool('add', {
      a: 10,
      b: 20,
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe('10 + 20 = 30');
  });
});
