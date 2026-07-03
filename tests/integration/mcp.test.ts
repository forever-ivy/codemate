import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MCPManager } from '../../src/mcp/MCPManager';

describe('MCP Integration', () => {
  let mcpManager: MCPManager;
  const configPath = path.join(__dirname, '../fixtures/mcp-test.json');

  beforeAll(async () => {
    // 创建测试配置
    const mockServerPath = path.join(__dirname, '../mocks/mock-mcp-server.ts');
    await fs.mkdir(path.dirname(configPath), { recursive: true });

    const config = {
      servers: {
        test: {
          command: 'npx',
          args: ['tsx', mockServerPath],
          env: {},
        },
      },
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // 初始化 MCP
    mcpManager = new MCPManager();
    await mcpManager.initialize(configPath);
  });

  afterAll(async () => {
    await mcpManager?.disconnect();
    await fs.rm(configPath, { force: true });
  });

  it('should load MCP tools', () => {
    const tools = mcpManager.getTools();

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name.includes('echo'))).toBe(true);
    expect(tools.some((t) => t.name.includes('add'))).toBe(true);
  });

  it('should execute MCP tool', async () => {
    const tools = mcpManager.getTools();
    const echoTool = tools.find((t) => t.name.includes('echo'));

    expect(echoTool).toBeDefined();
    if (!echoTool) {
      throw new Error('Expected echo MCP tool to be registered');
    }

    const result = await echoTool.execute({
      message: 'Integration test',
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Integration test');
  });
});
