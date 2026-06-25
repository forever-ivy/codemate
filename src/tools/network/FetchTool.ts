import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * FetchTool - HTTP 请求工具
 *
 * 功能：
 * 1. 发送 HTTP 请求
 * 2. 支持 GET/POST/PUT/DELETE
 * 3. 支持自定义 headers
 * 4. 返回响应内容
 *
 * 使用场景：
 * - 调用 API
 * - 下载文件
 * - 测试接口
 */
export class FetchTool extends Tool {
  name = 'fetch';
  description = 'Make HTTP requests';

  schema = z.object({
    url: z.string().describe('URL to fetch'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE'] as const)
      .optional()
      .describe('HTTP method'),
    headers: z.record(z.string(), z.string()).optional().describe('HTTP headers'),
    body: z.string().optional().describe('Request body (for POST/PUT)'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { url, method = 'GET', headers = {}, body } = input;

    console.log(`🌐 Fetching: ${method} ${url}`);

    try {
      // 1. 构建请求选项
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      // 2. 添加请求体（如果有）
      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = body;
      }

      // 3. 发送请求
      const response = await fetch(url, options);

      // 4. 读取响应
      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      console.log(`✅ Fetch completed: ${response.status}`);

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    } catch (error) {
      console.error(`❌ Fetch failed:`, error);

      if (error instanceof Error) {
        throw new Error(`Fetch failed: ${error.message}`);
      }
      throw new Error('Fetch failed: Unknown error');
    }
  }
}
