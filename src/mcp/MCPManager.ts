import * as fs from 'node:fs/promises';
import { MCPClient } from './MCPClient';
import { MCPTool } from './MCPTool';
import type { MCPConfig, MCPServerConfig } from './types';
import type { Tool } from '../tools/base/Tool';

/**
 * MCP 管理器
 *
 * 职责：
 * 1. 加载 MCP 配置
 * 2. 连接到所有 MCP 服务器
 * 3. 发现和注册工具
 * 4. 管理 MCP 客户端生命周期
 */
export class MCPManager {
  private clients = new Map<string, MCPClient>();
  private tools: Tool[] = [];
  private configs: Record<string, MCPServerConfig> = {};

  /**
   * 从配置文件初始化
   */
  async initialize(configPath: string): Promise<void> {
    console.log(`📋 Loading MCP config from: ${configPath}`);

    try {
      // 读取配置文件
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config: MCPConfig = JSON.parse(configContent);

      // 保存配置
      this.configs = config.servers;

      // 连接到所有服务器
      for (const [serverName, serverConfig] of Object.entries(config.servers)) {
        await this.connectServer(serverName, serverConfig);
      }

      console.log(`✅ MCP initialized with ${this.clients.size} servers`);
      console.log(`✅ Discovered ${this.tools.length} MCP tools`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log(`ℹ️  No MCP config found at ${configPath}`);
        return;
      }

      console.error(`❌ Failed to initialize MCP:`, error);
      throw error;
    }
  }

  /**
   * 连接到 MCP 服务器
   */
  private async connectServer(serverName: string, config: MCPServerConfig): Promise<void> {
    try {
      // 创建客户端
      const client = new MCPClient(serverName, config);

      // 连接
      await client.connect();

      // 发现工具
      const toolDefs = await client.listTools();

      // 包装为 Tool 对象
      for (const toolDef of toolDefs) {
        const tool = new MCPTool(client, toolDef, serverName);
        this.tools.push(tool);
      }

      // 保存客户端
      this.clients.set(serverName, client);

      console.log(`✅ Connected to MCP server: ${serverName} (${toolDefs.length} tools)`);
    } catch (error) {
      console.error(`❌ Failed to connect to MCP server ${serverName}:`, error);
      // 不抛出错误，允许其他服务器继续连接
    }
  }

  /**
   * 获取所有 MCP 工具
   */
  getTools(): Tool[] {
    return this.tools;
  }

  /**
   * 获取客户端
   */
  getClient(serverName: string): MCPClient | undefined {
    return this.clients.get(serverName);
  }

  /**
   * 断开所有连接
   */
  async disconnect(): Promise<void> {
    for (const [serverName, client] of this.clients.entries()) {
      try {
        await client.disconnect();
      } catch (error) {
        console.error(`Failed to disconnect from ${serverName}:`, error);
      }
    }

    this.clients.clear();
    this.tools = [];

    console.log(`🔌 All MCP servers disconnected`);
  }

  /**
   * 获取所有服务器状态
   */
  getServerStatus(): {
    isReady: boolean;
    isLoading: boolean;
    servers: Record<
      string,
      {
        status: import('./MCPClient').ServerStatus;
        error?: string;
        toolCount: number;
        tools: string[];
      }
    >;
    configs: Record<string, MCPServerConfig>;
  } {
    const servers: Record<string, any> = {};

    for (const [name, client] of this.clients.entries()) {
      servers[name] = {
        status: client.getStatus(),
        error: client.getError(),
        toolCount: client.getToolCount(),
        tools: client.getTools().map((t) => t.name),
      };
    }

    return {
      isReady: this.clients.size > 0,
      isLoading: false,
      servers,
      configs: this.configs,
    };
  }

  /**
   * 重新连接服务器
   */
  async reconnectServer(serverName: string): Promise<void> {
    const config = this.configs[serverName];
    if (!config) {
      throw new Error(`Server ${serverName} not found in config`);
    }

    // 断开现有连接
    const existingClient = this.clients.get(serverName);
    if (existingClient) {
      await existingClient.disconnect();
      this.clients.delete(serverName);

      // 移除该服务器的工具
      this.tools = this.tools.filter((tool) => {
        if (tool instanceof MCPTool) {
          return tool.serverName !== serverName;
        }
        return true;
      });
    }

    // 重新连接
    await this.connectServer(serverName, config);
  }
}
