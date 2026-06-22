import { z } from 'zod';
import { Tool } from '../tools/base/Tool';
import type { MCPClient } from './MCPClient';
import type { MCPToolDefinition, MCPToolResult } from './types';

export interface MCPToolMetadata {
  source: 'mcp';
  serverName: string;
  remoteToolName: string;
}

export interface MCPToolOutput {
  success: true;
  source: 'mcp';
  serverName: string;
  toolName: string;
  content: string;
  raw: MCPToolResult;
}

/**
 * MCP 工具包装类
 *
 * 调用链路：
 * MCPManager.connectServer -> MCPTool -> ToolManager.register -> ModelService.chatWithTools
 *
 * MCP server 返回的是远端工具定义。这里把它适配成项目内部统一的 Tool：
 * - name 使用 mcp__server__tool 命名空间，避免和内置工具冲突。
 * - metadata 保留来源信息，方便 schema 导出、trace 和后续审批 UI 展示。
 * - execute() 把 MCP content[] 规范化为 CLI 更容易消费的文本内容，同时保留 raw。
 */
export class MCPTool extends Tool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  serverName: string;
  metadata: MCPToolMetadata;

  private client: MCPClient;
  private toolDef: MCPToolDefinition;

  constructor(client: MCPClient, toolDef: MCPToolDefinition, serverName: string) {
    super();

    this.client = client;
    this.toolDef = toolDef;
    this.serverName = serverName;

    // 工具名称使用统一命名空间，避免和内置工具或其他 MCP server 冲突。
    this.name = `mcp__${this.sanitizeName(serverName)}__${this.sanitizeName(toolDef.name)}`;
    this.description = `[MCP:${serverName}] ${toolDef.description}`;
    this.metadata = {
      source: 'mcp',
      serverName,
      remoteToolName: toolDef.name,
    };

    // 将 JSON Schema 转换为 Zod Schema
    this.schema = this.jsonSchemaToZod(toolDef.inputSchema);
  }

  /**
   * 执行工具
   */
  async execute(input: Record<string, unknown>): Promise<MCPToolOutput> {
    try {
      // 调用 MCP 服务器
      const result = await this.client.callTool(this.toolDef.name, input);

      // 提取文本内容
      const textContent = result.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');

      return {
        success: true,
        source: 'mcp',
        serverName: this.serverName,
        toolName: this.toolDef.name,
        content: textContent,
        raw: result,
      };
    } catch (error) {
      console.error('❌ MCP tool execution failed:', error);

      if (error instanceof Error) {
        throw new Error(`MCP tool failed: ${error.message}`);
      }
      throw new Error('MCP tool failed: Unknown error');
    }
  }

  /**
   * 将 JSON Schema 转换为 Zod Schema
   *
   * 简化版本，只处理常见类型
   */
  private jsonSchemaToZod(schema: MCPToolDefinition['inputSchema']): z.ZodObject<z.ZodRawShape> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(schema.properties || {})) {
      const p = prop as {
        type?: string;
        description?: string;
      };

      // 根据类型创建 Zod schema
      let zodType: z.ZodTypeAny;

      switch (p.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.any());
          break;
        case 'object':
          zodType = z.record(z.any());
          break;
        default:
          zodType = z.any();
      }

      // 添加描述
      if (p.description) {
        zodType = zodType.describe(p.description);
      }

      // 处理可选字段
      if (!schema.required?.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  private sanitizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
