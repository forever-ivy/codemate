import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * EnvTool - 环境变量工具
 *
 * 功能：
 * 1. 获取环境变量
 * 2. 列出所有环境变量
 * 3. 检查环境变量是否存在
 *
 * 使用场景：
 * - 检查 API 密钥
 * - 获取配置信息
 * - 调试环境问题
 */
export class EnvTool extends Tool {
  name = 'env';
  description = 'Get environment variables';

  schema = z.object({
    key: z.string().optional().describe('Environment variable key (omit to list all)'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { key } = input;

    try {
      if (key) {
        // 获取单个环境变量
        const value = process.env[key];

        if (value === undefined) {
          return {
            success: false,
            message: `Environment variable not found: ${key}`,
          };
        }

        console.log(`✅ Got environment variable: ${key}`);

        return {
          success: true,
          key,
          value,
        };
      } else {
        // 列出所有环境变量
        const env = process.env;
        const keys = Object.keys(env);

        console.log(`✅ Listed ${keys.length} environment variables`);

        return {
          success: true,
          count: keys.length,
          variables: env,
        };
      }
    } catch (error) {
      console.error(`❌ Failed to get environment variable:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to get environment variable: ${error.message}`);
      }
      throw new Error('Failed to get environment variable: Unknown error');
    }
  }
}
