import { spawn, type ChildProcess } from 'node:child_process';
import type {
  MCPServerConfig,
  MCPRequest,
  MCPResponse,
  MCPToolDefinition,
  MCPToolResult,
} from './types';

/**
 * MCP 客户端
 *
 * 职责：
 * 1. 连接到 MCP 服务器
 * 2. 发现可用的工具
 * 3. 调用工具
 * 4. 处理响应
 */
export type ServerStatus = 'pending' | 'connecting' | 'connected' | 'failed' | 'disconnected';

export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >();

  private serverName: string;
  private config: MCPServerConfig;
  private status: ServerStatus = 'pending';
  private error: string | undefined;
  private tools: MCPToolDefinition[] = [];

  constructor(serverName: string, config: MCPServerConfig) {
    this.serverName = serverName;
    this.config = config;
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    console.log(`🔌 Connecting to MCP server: ${this.serverName}`);
    this.status = 'connecting';
    this.error = undefined;

    try {
      // 启动 MCP 服务器进程
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (!this.process.stdout || !this.process.stdin) {
        throw new Error('Failed to create MCP server process');
      }

      // 监听 stdout（服务器响应）
      let buffer = '';
      this.process.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();

        // 处理完整的 JSON-RPC 消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response: MCPResponse = JSON.parse(line);
              this.handleResponse(response);
            } catch (error) {
              console.error('Failed to parse MCP response:', error);
            }
          }
        }
      });

      // 监听 stderr（错误日志）
      this.process.stderr?.on('data', (data: Buffer) => {
        console.error(`[MCP ${this.serverName}]`, data.toString());
      });

      // 初始化连接
      await this.initialize();

      this.status = 'connected';
      console.log(`✅ Connected to MCP server: ${this.serverName}`);
    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to connect to ${this.serverName}:`, error);
      throw error;
    }
  }

  /**
   * 初始化连接
   */
  private async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'aicli',
        version: '1.0.0',
      },
    });
  }

  /**
   * 发现可用的工具
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    console.log(`🔍 Discovering tools from: ${this.serverName}`);

    const response = await this.sendRequest('tools/list', {});
    this.tools = response.tools || [];

    console.log(`✅ Found ${this.tools.length} tools from ${this.serverName}`);

    return this.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    console.log(`🛠️  Calling MCP tool: ${this.serverName}.${name}`);
    console.log(`   Arguments:`, JSON.stringify(args));

    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    console.log(`✅ Tool executed: ${this.serverName}.${name}`);

    return response;
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.process || !this.process.stdin) {
      throw new Error('MCP server not connected');
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    // 创建 Promise 等待响应
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000); // 30 秒超时
    });

    // 发送请求
    this.process.stdin.write(JSON.stringify(request) + '\n');

    return promise;
  }

  /**
   * 处理响应
   */
  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id as number);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id as number);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.status = 'disconnected';
    console.log(`🔌 Disconnected from MCP server: ${this.serverName}`);
  }

  /**
   * 获取连接状态
   */
  getStatus(): ServerStatus {
    return this.status;
  }

  /**
   * 获取错误信息
   */
  getError(): string | undefined {
    return this.error;
  }

  /**
   * 获取工具数量
   */
  getToolCount(): number {
    return this.tools.length;
  }

  /**
   * 获取工具列表
   */
  getTools(): MCPToolDefinition[] {
    return this.tools;
  }
}
