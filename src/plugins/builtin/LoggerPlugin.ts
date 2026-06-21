import type { Application } from '../../application/Application';
import type { Tool } from '../../tools/base/Tool';
import { Plugin } from '../base/Plugin';

/**
 * LoggerPlugin - 日志插件
 *
 * 功能：
 * - 记录工具调用
 * - 记录工具结果
 * - 记录插件生命周期
 */
export class LoggerPlugin extends Plugin {
  name = 'logger';
  version = '1.0.0';
  description = 'Log tool executions';

  async onLoad(_app: Application): Promise<void> {
    console.log('[Logger] Plugin loaded');
  }

  async onUnload(_app: Application): Promise<void> {
    console.log('[Logger] Plugin unloaded');
  }

  async onToolBefore(tool: Tool, input: unknown): Promise<void> {
    console.log(`[Logger] Tool ${tool.name} called with:`, JSON.stringify(input, null, 2));
  }

  async onToolAfter(tool: Tool, result: unknown): Promise<void> {
    console.log(`[Logger] Tool ${tool.name} returned:`, JSON.stringify(result, null, 2));
  }
}
