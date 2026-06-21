import type { Application } from '../../application/Application';
import type { Tool } from '../../tools/base/Tool';
import { Plugin } from '../base/Plugin';

/**
 * PerformancePlugin - 性能监控插件
 *
 * 功能：
 * - 记录工具执行时间
 * - 统计工具调用次数
 * - 计算平均执行时间
 */
export class PerformancePlugin extends Plugin {
  name = 'performance';
  version = '1.0.0';
  description = 'Monitor tool performance';

  /**
   * 工具执行开始时间
   */
  private startTimes = new Map<string, number>();

  /**
   * 工具执行统计
   */
  private stats = new Map<
    string,
    {
      count: number;
      totalTime: number;
      avgTime: number;
    }
  >();

  async onLoad(_app: Application): Promise<void> {
    console.log('[Performance] Plugin loaded');
  }

  async onUnload(_app: Application): Promise<void> {
    console.log('[Performance] Plugin unloaded');
    this.printStats();
  }

  async onToolBefore(tool: Tool, _input: unknown): Promise<void> {
    // 记录开始时间
    this.startTimes.set(tool.name, Date.now());
  }

  async onToolAfter(tool: Tool, _result: unknown): Promise<void> {
    // 计算执行时间
    const startTime = this.startTimes.get(tool.name);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.startTimes.delete(tool.name);

    // 更新统计
    const stat = this.stats.get(tool.name) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
    };

    stat.count++;
    stat.totalTime += duration;
    stat.avgTime = stat.totalTime / stat.count;

    this.stats.set(tool.name, stat);

    console.log(`[Performance] ${tool.name} took ${duration}ms`);
  }

  /**
   * 打印统计信息
   */
  private printStats(): void {
    if (this.stats.size === 0) {
      console.log('[Performance] No statistics available');
      return;
    }

    console.log('\n[Performance] Statistics:');
    for (const [name, stat] of this.stats.entries()) {
      console.log(`  ${name}:`);
      console.log(`    Calls: ${stat.count}`);
      console.log(`    Total: ${stat.totalTime}ms`);
      console.log(`    Avg: ${stat.avgTime.toFixed(2)}ms`);
    }
    console.log('');
  }
}
