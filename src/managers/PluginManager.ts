import type { Application } from '../application/Application';
import { PluginRegistry } from '../plugins/PluginRegistry';
import type { Plugin } from '../plugins/base/Plugin';
import type { Tool } from '../tools/base/Tool';

export type PluginLifecycleStatus = 'loaded' | 'unloaded' | 'failed' | 'not_found';
export type PluginLifecycleSource = 'runtime' | 'builtin' | 'config';

export interface PluginLifecycleRecord {
  name: string;
  version?: string;
  description?: string;
  status: PluginLifecycleStatus;
  source: PluginLifecycleSource;
  loadedAt?: number;
  unloadedAt?: number;
  error?: string;
}

export interface PluginLoadSummary {
  loaded: string[];
  failed: string[];
  notFound: string[];
}

/**
 * PluginManager - 插件管理器
 *
 * 职责：
 * 1. 加载和卸载插件
 * 2. 管理插件生命周期
 * 3. 触发插件钩子
 * 4. 列出已加载的插件
 */
export class PluginManager {
  /**
   * 插件存储
   *
   * key: 插件名称
   * value: 插件实例
   */
  private plugins = new Map<string, Plugin>();
  private lifecycleRecords = new Map<string, PluginLifecycleRecord>();

  /**
   * Application 实例
   */
  private app: Application;
  private registry: PluginRegistry;

  constructor(app: Application, registry = new PluginRegistry()) {
    this.app = app;
    this.registry = registry;
  }

  /**
   * 加载插件
   *
   * @param plugin 插件实例
   * @throws 如果插件名称已存在
   */
  async load(plugin: Plugin, source: PluginLifecycleSource = 'runtime'): Promise<void> {
    // 检查插件名称是否已存在
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already loaded: ${plugin.name}`);
    }

    console.log(`🔌 Loading plugin: ${plugin.name} v${plugin.version}`);

    try {
      // 调用插件的 onLoad 钩子
      await plugin.onLoad(this.app);

      // 注册插件
      this.plugins.set(plugin.name, plugin);
      this.lifecycleRecords.set(plugin.name, {
        ...plugin.getInfo(),
        status: 'loaded',
        source,
        loadedAt: Date.now(),
      });

      console.log(`✅ Plugin loaded: ${plugin.name}`);
    } catch (error) {
      this.lifecycleRecords.set(plugin.name, {
        ...plugin.getInfo(),
        status: 'failed',
        source,
        error: getErrorMessage(error),
      });
      console.error(`❌ Failed to load plugin: ${plugin.name}`, error);
      throw error;
    }
  }

  async loadFromConfig(pluginNames: string[]): Promise<PluginLoadSummary> {
    const summary: PluginLoadSummary = {
      loaded: [],
      failed: [],
      notFound: [],
    };

    for (const name of pluginNames) {
      if (this.plugins.has(name)) {
        continue;
      }

      const plugin = this.registry.create(name);
      if (!plugin) {
        this.lifecycleRecords.set(name, {
          name,
          status: 'not_found',
          source: 'config',
          error: 'Plugin is not registered',
        });
        summary.notFound.push(name);
        continue;
      }

      try {
        await this.load(plugin, 'builtin');
        summary.loaded.push(name);
      } catch (_error) {
        summary.failed.push(name);
      }
    }

    return summary;
  }

  /**
   * 卸载插件
   *
   * @param name 插件名称
   * @throws 如果插件不存在
   */
  async unload(name: string): Promise<void> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    console.log(`🔌 Unloading plugin: ${name}`);

    try {
      // 调用插件的 onUnload 钩子
      await plugin.onUnload(this.app);

      // 移除插件
      this.plugins.delete(name);
      this.lifecycleRecords.set(name, {
        ...plugin.getInfo(),
        status: 'unloaded',
        source: this.lifecycleRecords.get(name)?.source ?? 'runtime',
        loadedAt: this.lifecycleRecords.get(name)?.loadedAt,
        unloadedAt: Date.now(),
      });

      console.log(`✅ Plugin unloaded: ${name}`);
    } catch (error) {
      console.error(`❌ Failed to unload plugin: ${name}`, error);
      throw error;
    }
  }

  /**
   * 检查插件是否已加载
   *
   * @param name 插件名称
   * @returns 是否已加载
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * 获取插件
   *
   * @param name 插件名称
   * @returns 插件实例
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 列出所有插件
   *
   * @returns 插件名称数组
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * 获取所有插件的信息
   *
   * @returns 插件信息数组
   */
  getAllInfo(): Array<{ name: string; version: string; description?: string }> {
    return Array.from(this.plugins.values()).map((plugin) => plugin.getInfo());
  }

  getLifecycleRecord(name: string): PluginLifecycleRecord | undefined {
    return this.lifecycleRecords.get(name);
  }

  getLifecycleRecords(): PluginLifecycleRecord[] {
    return Array.from(this.lifecycleRecords.values());
  }

  listRegisteredPlugins(): string[] {
    return this.registry.list();
  }

  /**
   * 获取插件数量
   *
   * @returns 插件数量
   */
  count(): number {
    return this.plugins.size;
  }

  /**
   * 触发工具执行前钩子
   *
   * @param tool 工具实例
   * @param input 工具输入
   */
  async triggerToolBefore(tool: Tool, input: unknown): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.onToolBefore(tool, input);
      } catch (error) {
        console.error(`❌ Plugin ${plugin.name} onToolBefore failed:`, error);
        // 继续执行其他插件，不中断流程
      }
    }
  }

  /**
   * 触发工具执行后钩子
   *
   * @param tool 工具实例
   * @param result 工具结果
   */
  async triggerToolAfter(tool: Tool, result: unknown): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.onToolAfter(tool, result);
      } catch (error) {
        console.error(`❌ Plugin ${plugin.name} onToolAfter failed:`, error);
        // 继续执行其他插件，不中断流程
      }
    }
  }

  /**
   * 卸载所有插件
   */
  async unloadAll(): Promise<void> {
    const names = this.list();
    for (const name of names) {
      await this.unload(name);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
