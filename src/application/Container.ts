import { OutputStyleManager } from '../styles/managers/OutputStyleManager';
import type { Paths } from '../services/Paths';
import { FileHistory } from '../snapshot/FileHistory';
import type { EventBus } from '../services/EventBus';
import { SpecManager } from '../spec/SpecManager.js';
import { SpecStorage } from '../spec/SpecStorage.js';
import { PlanManager } from '../spec/plan/PlanManager.js';
import { PlanStorage } from '../spec/plan/PlanStorage.js';
import { PlanExecutor } from '../spec/execution/PlanExecutor.js';
import type { ModelService } from '../services/ModelService.js';
/**
 * 依赖注入容器
 *
 * 作用：管理所有服务的注册和获取
 *
 * 为什么需要它？
 * 1. 解耦：服务之间不直接依赖，通过容器获取
 * 2. 可测试：测试时可以替换成 mock 服务
 * 3. 单例：确保每个服务只有一个实例
 */
export class Container {
  // 用 Map 存储所有服务
  // key: 服务名称（字符串）
  // value: 服务实例（任意类型）
  private services = new Map<string, any>();

  // OutputStyleManager 实例（懒加载）
  private outputStyleManager?: OutputStyleManager;

  /**
   * 注册服务
   *
   * @param name 服务名称，如 'model', 'tool'
   * @param instance 服务实例
   *
   * 示例：
   * container.register('model', new ModelService());
   */
  register<T>(name: string, instance: T): void {
    // 检查是否已经注册过
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }

    // 存储服务
    this.services.set(name, instance);
    console.log(`✅ Registered service: ${name}`);
  }

  /**
   * 获取服务（类型安全版本）
   *
   * @param name 服务名称
   * @returns 服务实例
   * @throws 如果服务不存在
   *
   * 使用泛型实现类型安全：
   * - T 是服务的类型
   * - 默认是 unknown（向后兼容）
   * - 调用时可以指定类型：get<ModelService>('model')
   *
   * 示例：
   * const modelService = container.get<ModelService>('model');
   * // modelService 的类型是 ModelService，有完整的类型提示
   */
  get<T = unknown>(name: string): T {
    const service = this.services.get(name);

    // 检查服务是否存在
    if (service === undefined) {
      throw new Error(`Service not found: ${name}`);
    }

    // 返回服务（使用类型断言）
    return service as T;
  }

  /**
   * 检查服务是否存在
   *
   * @param name 服务名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * 列出所有服务名称
   *
   * @returns 服务名称数组
   */
  list(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 获取服务数量
   *
   * @returns 服务数量
   */
  count(): number {
    return this.services.size;
  }

  /**
   * 获取 OutputStyleManager
   *
   * @returns OutputStyleManager 实例
   */
  getOutputStyleManager(): OutputStyleManager {
    if (!this.outputStyleManager) {
      // 从容器中获取 Paths 服务
      const paths = this.get<Paths>('paths');

      this.outputStyleManager = new OutputStyleManager({
        paths,
      });
    }
    return this.outputStyleManager;
  }

  /**
   * 获取 FileHistory
   *
   * @returns FileHistory 实例
   */
  getFileHistory(): FileHistory {
    if (!this.services.has('fileHistory')) {
      const paths = this.get<Paths>('paths');
      const eventBus = this.get<EventBus>('eventBus');
      this.services.set('fileHistory', new FileHistory(paths, eventBus));
    }
    return this.services.get('fileHistory') as FileHistory;
  }

  /**
   * 获取 SpecManager
   *
   * @returns SpecManager 实例
   */
  getSpecManager(): SpecManager {
    if (!this.services.has('spec')) {
      const eventBus = this.get<EventBus>('eventBus');
      const paths = this.get<Paths>('paths');
      this.services.set('spec', new SpecManager(eventBus, paths));
    }
    return this.services.get('spec') as SpecManager;
  }

  /**
   * 获取 SpecStorage
   *
   * @returns SpecStorage 实例
   */
  getSpecStorage(): SpecStorage {
    if (!this.services.has('specStorage')) {
      const paths = this.get<Paths>('paths');
      const specsDir = `${paths.getDataDir()}/specs`;
      const backupDir = `${paths.getDataDir()}/specs/backups`;
      const indexFile = `${paths.getDataDir()}/specs/index.json`;
      this.services.set('specStorage', new SpecStorage(specsDir, backupDir, indexFile));
    }
    return this.services.get('specStorage') as SpecStorage;
  }

  /**
   * 获取 PlanManager
   *
   * @returns PlanManager 实例
   */
  getPlanManager(): PlanManager {
    if (!this.services.has('plan')) {
      const planStorage = this.getPlanStorage();
      const specManager = this.getSpecManager();
      const eventBus = this.get<EventBus>('eventBus');
      const modelService = this.get<ModelService>('model');
      this.services.set('plan', new PlanManager(planStorage, specManager, eventBus, modelService));
    }
    return this.services.get('plan') as PlanManager;
  }

  /**
   * 获取 PlanStorage
   *
   * @returns PlanStorage 实例
   */
  getPlanStorage(): PlanStorage {
    if (!this.services.has('planStorage')) {
      const paths = this.get<Paths>('paths');
      this.services.set('planStorage', new PlanStorage(paths));
    }
    return this.services.get('planStorage') as PlanStorage;
  }

  /**
   * 获取 PlanExecutor
   *
   * @returns PlanExecutor 实例
   */
  getPlanExecutor(): PlanExecutor {
    if (!this.services.has('planExecutor')) {
      const eventBus = this.get<EventBus>('eventBus');
      const modelService = this.get<ModelService>('model');
      this.services.set('planExecutor', new PlanExecutor(eventBus, modelService));
    }
    return this.services.get('planExecutor') as PlanExecutor;
  }
}
