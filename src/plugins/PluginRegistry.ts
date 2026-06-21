import type { Plugin } from './base/Plugin';
import { LoggerPlugin } from './builtin/LoggerPlugin';
import { PerformancePlugin } from './builtin/PerformancePlugin';
import { SecurityPlugin } from './builtin/SecurityPlugin';

export type PluginFactory = () => Plugin;

/**
 * PluginRegistry 保存项目内可按名称启用的插件工厂。
 *
 * 第 80 章先注册内置插件，后续如果支持本地插件目录或 npm 插件，
 * 只需要扩展这个注册表，不需要让 PluginManager 直接关心加载来源。
 */
export class PluginRegistry {
  private factories = new Map<string, PluginFactory>();

  constructor(factories: Record<string, PluginFactory> = createBuiltinPluginFactories()) {
    for (const [name, factory] of Object.entries(factories)) {
      this.register(name, factory);
    }
  }

  register(name: string, factory: PluginFactory): void {
    this.factories.set(name, factory);
  }

  create(name: string): Plugin | undefined {
    return this.factories.get(name)?.();
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  list(): string[] {
    return Array.from(this.factories.keys());
  }
}

function createBuiltinPluginFactories(): Record<string, PluginFactory> {
  return {
    logger: () => new LoggerPlugin(),
    performance: () => new PerformancePlugin(),
    security: () => new SecurityPlugin(),
  };
}
