import type { EventHandler } from '../types/index';

/**
 * EventBus - 消息总线（企业级实现）
 *
 * 职责：
 * 1. 事件发布（emit）
 * 2. 事件订阅（on）
 * 3. 取消订阅（off）
 * 4. 一次性订阅（once）
 *
 * 设计模式：发布-订阅模式
 */
export class EventBus {
  /**
   * 事件监听器存储
   *
   * 结构：Map<事件名, Set<处理器>>
   * 使用 Set 避免重复注册
   */
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * 订阅事件
   *
   * @param event 事件名称
   * @param handler 事件处理器
   *
   * 示例：
   * eventBus.on('session.created', (data) => {
   *   console.log('会话已创建:', data.session.id);
   * });
   */
  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(handler);

    console.log(`📡 Event listener registered: ${event} (${handlers.size} listeners)`);
  }

  /**
   * 一次性订阅事件
   *
   * 处理器执行一次后自动取消订阅
   *
   * @param event 事件名称
   * @param handler 事件处理器
   *
   * 示例：
   * eventBus.once('session.created', (data) => {
   *   console.log('首次创建会话');
   * });
   */
  once(event: string, handler: EventHandler): void {
    const onceHandler: EventHandler = (data) => {
      handler(data);
      this.off(event, onceHandler);
    };

    this.on(event, onceHandler);
  }

  /**
   * 取消订阅事件
   *
   * @param event 事件名称
   * @param handler 事件处理器
   *
   * 示例：
   * const handler = (data) => console.log(data);
   * eventBus.on('session.created', handler);
   * eventBus.off('session.created', handler);
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);

    // 如果没有监听器了，删除事件
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }

    console.log(`📡 Event listener removed: ${event} (${handlers.size} listeners remaining)`);
  }

  /**
   * 发布事件
   *
   * @param event 事件名称
   * @param data 事件数据
   *
   * 示例：
   * eventBus.emit('session.created', {
   *   session,
   *   timestamp: Date.now(),
   * });
   */
  emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      // 隐藏事件日志，只在debug模式下显示
      return;
    }

    // 隐藏事件日志，只在debug模式下显示

    // 执行所有处理器
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`❌ Event handler error (${event}):`, error);
        // 不中断其他处理器的执行
      }
    }
  }

  /**
   * 移除所有监听器
   *
   * @param event 事件名称（可选）
   *
   * 如果提供 event，只移除该事件的监听器
   * 如果不提供，移除所有事件的监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      console.log(`📡 All listeners removed for event: ${event}`);
    } else {
      this.listeners.clear();
      console.log('📡 All listeners removed');
    }
  }

  /**
   * 获取事件的监听器数量
   *
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: string): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }

  /**
   * 获取所有事件名称
   *
   * @returns 事件名称数组
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
