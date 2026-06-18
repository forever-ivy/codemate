import { SlashCommand } from '../base/SlashCommand';
import type { Application } from '../../application/Application';

/**
 * ModelCommand - 切换模型
 *
 * 用法：
 * /model gpt-4           # 切换到 GPT-4
 * /model deepseek-chat   # 切换到 DeepSeek
 */
export class ModelCommand extends SlashCommand {
  name = 'model';
  description = 'Switch AI model';
  aliases = ['m'];

  validate(args: string[]): boolean {
    if (args.length === 0) {
      console.log('❌ Usage: /model <model-name>');
      return false;
    }
    return true;
  }

  async execute(args: string[], _app: Application): Promise<void> {
    const newModel = args[0];

    // 注意：实际切换模型需要重新创建 ModelService
    // 这里只是显示消息，完整实现需要在 Application 中添加 switchModel 方法
    console.log(`💡 Model switching to: ${newModel}`);
    console.log('⚠️  Note: Full model switching requires Application.switchModel() implementation');
    console.log('   This will be implemented in a future chapter');
  }
}
