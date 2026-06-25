import { z } from 'zod';
import { Tool } from '../base/Tool';

/**
 * ExitPlanTool - 退出计划模式
 *
 * 功能：
 * 1. 退出当前的计划模式
 * 2. 返回正常对话模式
 *
 * 什么是计划模式？
 * - 计划模式是一种特殊的对话模式
 * - AI 会先制定计划，然后执行
 *
 * 使用场景：
 * - 完成计划后退出
 * - 取消当前计划
 * - 切换到正常模式
 */
export class ExitPlanTool extends Tool {
  name = 'exit_plan';
  description = 'Exit plan mode and return to normal conversation';

  schema = z.object({
    reason: z.string().optional().describe('Reason for exiting plan mode'),
  });

  async execute(input: z.infer<typeof this.schema>): Promise<any> {
    const { reason } = input;

    console.log(`🚪 Exiting plan mode`);
    if (reason) {
      console.log(`   Reason: ${reason}`);
    }

    try {
      // 1. 清除计划模式标志
      // 实际实现中，这里应该修改应用状态
      // 例如：context.planMode = false;

      // 2. 返回结果
      console.log(`✅ Exited plan mode`);

      return {
        success: true,
        message: 'Exited plan mode successfully',
        reason,
      };
    } catch (error) {
      console.error(`❌ Failed to exit plan mode:`, error);

      if (error instanceof Error) {
        throw new Error(`Failed to exit plan mode: ${error.message}`);
      }
      throw new Error('Failed to exit plan mode: Unknown error');
    }
  }
}
