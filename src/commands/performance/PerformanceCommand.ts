import { SlashCommand } from '../base/SlashCommand';
import type { Container } from '../../application/Container';
import type { Application } from '../../application/Application';
import type { ModelService } from '../../services/ModelService';

/**
 * /performance - 性能监控命令
 *
 * 显示性能统计信息
 */
export class PerformanceCommand extends SlashCommand {
  name = 'performance';
  description = '显示性能统计信息';
  aliases = ['perf'];

  constructor(private container: Container) {
    super();
  }

  async execute(_args: string[], _app: Application): Promise<void> {
    const modelService = this.container.get<ModelService>('ModelService');

    // 获取性能监控器（如果 ModelService 有的话）
    // 注意：这需要 ModelService 暴露 performanceMonitor
    const performanceMonitor = (modelService as any).performanceMonitor;

    if (!performanceMonitor) {
      console.log('⚠️  性能监控未启用');
      return;
    }

    // 生成性能报告
    const report = performanceMonitor.generateReport();

    console.log(report);
  }
}
