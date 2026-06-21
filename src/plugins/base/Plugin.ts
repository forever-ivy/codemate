import type { Application } from '../../application/Application';
import type { Tool } from '../../tools/base/Tool';

/**
 * Plugin - 插件基类
 *
 * 所有插件都继承这个基类
 *
 * 为什么需要插件？
 * 1. 可扩展性：不修改核心代码就能添加功能
 * 2. 社区贡献：用户可以创建和分享插件
 * 3. 功能隔离：插件独立运行，不影响核心
 */
export abstract class Plugin {
  /**
   * 插件名称（必须实现）
   *
   * 示例：'logger', 'performance', 'security'
   */
  abstract name: string;

  /**
   * 插件版本（必须实现）
   *
   * 示例：'1.0.0'
   */
  abstract version: string;

  /**
   * 插件描述（可选）
   */
  description?: string;

  /**
   * 插件加载时调用（可选，子类可以覆盖）
   *
   * 用途：
   * - 初始化资源
   * - 注册事件监听器
   * - 加载配置
   *
   * @param app Application 实例
   */
  async onLoad(_app: Application): Promise<void> {
    // 默认不做任何事
  }

  /**
   * 插件卸载时调用（可选，子类可以覆盖）
   *
   * 用途：
   * - 清理资源
   * - 移除事件监听器
   * - 保存状态
   *
   * @param app Application 实例
   */
  async onUnload(_app: Application): Promise<void> {
    // 默认不做任何事
  }

  /**
   * 工具执行前调用（可选，子类可以覆盖）
   *
   * 用途：
   * - 记录日志
   * - 验证权限
   * - 修改输入
   * - 性能监控
   *
   * @param tool 工具实例
   * @param input 工具输入
   */
  async onToolBefore(_tool: Tool, _input: unknown): Promise<void> {
    // 默认不做任何事
  }

  /**
   * 工具执行后调用（可选，子类可以覆盖）
   *
   * 用途：
   * - 记录结果
   * - 性能统计
   * - 结果转换
   * - 错误处理
   *
   * @param tool 工具实例
   * @param result 工具结果
   */
  async onToolAfter(_tool: Tool, _result: unknown): Promise<void> {
    // 默认不做任何事
  }

  /**
   * 获取插件信息
   *
   * @returns 插件信息对象
   */
  getInfo(): { name: string; version: string; description?: string } {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
    };
  }
}
