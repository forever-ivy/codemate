#!/usr/bin/env node

/**
 * Mock MCP 服务器
 *
 * 用于测试 MCP 客户端
 * 实现简单的 echo 和 add 工具
 */

import * as readline from 'node:readline';

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// 处理请求
rl.on('line', (line: string) => {
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error('Error:', error);
  }
});

function handleRequest(request: any): any {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'mock-mcp-server',
            version: '1.0.0',
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'echo',
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
            {
              name: 'add',
              description: 'Add two numbers',
              inputSchema: {
                type: 'object',
                properties: {
                  a: {
                    type: 'number',
                    description: 'First number',
                  },
                  b: {
                    type: 'number',
                    description: 'Second number',
                  },
                },
                required: ['a', 'b'],
              },
            },
          ],
        },
      };

    case 'tools/call':
      const { name, arguments: args } = params;

      if (name === 'echo') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Echo: ${args.message}`,
              },
            ],
          },
        };
      }

      if (name === 'add') {
        const sum = args.a + args.b;
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `${args.a} + ${args.b} = ${sum}`,
              },
            ],
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`,
        },
      };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown method: ${method}`,
        },
      };
  }
}
