import * as readline from 'node:readline/promises';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * ConfirmTool - 确认操作
 *
 * 功能：
 * 1. 向用户确认操作
 * 2. 只接受 yes/no 回答
 * 3. 返回布尔值
 *
 * 使用场景：
 * - 危险操作前确认
 * - 删除文件确认
 * - 执行命令确认
 *
 * 注意：这是交互式工具，会阻塞执行！
 */
export class ConfirmTool extends Tool {
  name = 'confirm';
  description = 'Ask user for confirmation (yes/no)';

  schema = z.object({
    message: z.string().describe('Confirmation message'),
    defaultValue: z.boolean().optional().describe('Default value if user presses Enter'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { message, defaultValue = false } = input;

    console.log(`❓ Confirming: ${message}`);

    try {
      // 1. 创建 readline 接口
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // 2. 构建提示文本
      const defaultText = defaultValue ? 'Y/n' : 'y/N';
      const prompt = `${message} (${defaultText}): `;

      // 3. 询问用户
      const answer = await rl.question(prompt);
      rl.close();

      // 4. 解析回答
      const trimmed = answer.trim().toLowerCase();
      let confirmed: boolean;

      if (trimmed === '') {
        // 用户直接按 Enter，使用默认值
        confirmed = defaultValue;
      } else if (trimmed === 'y' || trimmed === 'yes') {
        confirmed = true;
      } else if (trimmed === 'n' || trimmed === 'no') {
        confirmed = false;
      } else {
        // 无效输入，使用默认值
        confirmed = defaultValue;
      }

      console.log(`✅ User confirmed: ${confirmed}`);

      return {
        success: true,
        message,
        confirmed,
      };
    } catch (error) {
      console.error(`❌ Failed to confirm:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to confirm: ${error.message}`);
      }
      throw new Error('Failed to confirm: Unknown error');
    }
  }
}
