import * as readline from 'node:readline/promises';
import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * AskUserTool - 询问用户
 *
 * 功能：
 * 1. 向用户提问
 * 2. 等待用户输入
 * 3. 返回用户的回答
 *
 * 使用场景：
 * - 需要用户确认
 * - 需要用户提供信息
 * - 交互式操作
 *
 * 注意：这是交互式工具，会阻塞执行！
 */
export class AskUserTool extends Tool {
  name = 'ask_user';
  description = 'Ask user a question and wait for response';

  schema = z.object({
    question: z.string().describe('Question to ask the user'),
    defaultAnswer: z.string().optional().describe('Default answer if user presses Enter'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { question, defaultAnswer } = input;

    console.log(`❓ Asking user: ${question}`);

    try {
      // 1. 创建 readline 接口
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // 2. 构建提示文本
      let prompt = question;
      if (defaultAnswer) {
        prompt += ` (default: ${defaultAnswer})`;
      }
      prompt += ': ';

      // 3. 询问用户
      const answer = await rl.question(prompt);
      rl.close();

      // 4. 处理回答
      const finalAnswer = answer.trim() || defaultAnswer || '';

      console.log(`✅ User answered: ${finalAnswer}`);

      return {
        success: true,
        question,
        answer: finalAnswer,
      };
    } catch (error) {
      console.error(`❌ Failed to ask user:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to ask user: ${error.message}`);
      }
      throw new Error('Failed to ask user: Unknown error');
    }
  }
}
