import type { Application } from '../../application/Application';
import type { Tool } from '../../tools/base/Tool';
import { Plugin } from '../base/Plugin';

/**
 * SecurityPlugin - 安全插件
 *
 * 功能：
 * - 验证工具权限
 * - 阻止危险操作
 * - 记录安全事件
 */
export class SecurityPlugin extends Plugin {
  name = 'security';
  version = '1.0.0';
  description = 'Security checks for tool executions';

  /**
   * 危险工具列表
   */
  private dangerousTools = new Set(['bash', 'exec', 'delete_file']);

  /**
   * 是否启用严格模式
   */
  private strictMode = false;

  constructor(strictMode = false) {
    super();
    this.strictMode = strictMode;
  }

  async onLoad(_app: Application): Promise<void> {
    console.log('[Security] Plugin loaded');
    console.log(`[Security] Strict mode: ${this.strictMode ? 'ON' : 'OFF'}`);
  }

  async onUnload(_app: Application): Promise<void> {
    console.log('[Security] Plugin unloaded');
  }

  async onToolBefore(tool: Tool, input: unknown): Promise<void> {
    // 检查是否是危险工具
    if (this.dangerousTools.has(tool.name)) {
      console.warn(`[Security] ⚠️  Dangerous tool detected: ${tool.name}`);

      // 严格模式下阻止执行
      if (this.strictMode) {
        throw new Error(`[Security] Tool ${tool.name} is blocked in strict mode`);
      }

      // 记录安全事件
      console.log(`[Security] Tool ${tool.name} called with:`, input);
    }
  }

  async onToolAfter(tool: Tool, _result: unknown): Promise<void> {
    // 记录危险工具的执行
    if (this.dangerousTools.has(tool.name)) {
      console.log(`[Security] Tool ${tool.name} executed successfully`);
    }
  }

  /**
   * 添加危险工具
   */
  addDangerousTool(toolName: string): void {
    this.dangerousTools.add(toolName);
    console.log(`[Security] Added dangerous tool: ${toolName}`);
  }

  /**
   * 移除危险工具
   */
  removeDangerousTool(toolName: string): void {
    this.dangerousTools.delete(toolName);
    console.log(`[Security] Removed dangerous tool: ${toolName}`);
  }
}
