import { EventEmitter } from 'events';

export interface CommandState {
  id: string;
  name: string;
  data: any;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
  metadata: Record<string, any>;
}

export interface StateUpdate {
  commandId: string;
  updates: Partial<CommandState>;
  source: string;
}

export class CommandStateManager extends EventEmitter {
  private states = new Map<string, CommandState>();
  private subscriptions = new Map<string, Set<string>>();
  private updateQueue: StateUpdate[] = [];
  private isProcessingQueue = false;

  // 注册命令状态
  registerCommand(commandId: string, initialState: Partial<CommandState>): void {
    const state: CommandState = {
      id: commandId,
      name: commandId,
      data: null,
      loading: false,
      error: null,
      lastUpdated: new Date(),
      metadata: {},
      ...initialState,
    };

    this.states.set(commandId, state);
    this.emit('commandRegistered', { commandId, state });
  }

  // 更新命令状态
  updateCommandState(commandId: string, updates: Partial<CommandState>, source = 'unknown'): void {
    const currentState = this.states.get(commandId);
    if (!currentState) {
      console.warn(`Command ${commandId} not registered`);
      return;
    }

    const stateUpdate: StateUpdate = {
      commandId,
      updates: { ...updates, lastUpdated: new Date() },
      source,
    };

    this.updateQueue.push(stateUpdate);
    this.processUpdateQueue();
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift()!;
        await this.applyStateUpdate(update);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async applyStateUpdate(update: StateUpdate): Promise<void> {
    const { commandId, updates, source } = update;
    const currentState = this.states.get(commandId);

    if (!currentState) return;

    const newState = { ...currentState, ...updates };
    this.states.set(commandId, newState);

    // 发出状态更新事件
    this.emit('stateUpdated', {
      commandId,
      oldState: currentState,
      newState,
      source,
    });

    // 通知订阅者
    const subscribers = this.subscriptions.get(commandId);
    if (subscribers) {
      for (const subscriberId of subscribers) {
        this.emit(`stateUpdated:${subscriberId}`, { commandId, state: newState });
      }
    }

    // 如果是数据更新，触发数据验证
    if (updates.data !== undefined) {
      await this.validateCommandData(commandId, newState);
    }
  }

  private async validateCommandData(commandId: string, state: CommandState): Promise<void> {
    try {
      if (state.data === null || state.data === undefined) {
        this.updateCommandState(commandId, { error: 'No data available' }, 'validator');
        return;
      }

      // 清除之前的错误
      if (state.error && state.error.includes('validation')) {
        this.updateCommandState(commandId, { error: null }, 'validator');
      }
    } catch (error) {
      this.updateCommandState(
        commandId,
        {
          error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        'validator'
      );
    }
  }

  // 订阅命令状态变化
  subscribe(commandId: string, subscriberId: string): () => void {
    if (!this.subscriptions.has(commandId)) {
      this.subscriptions.set(commandId, new Set());
    }

    this.subscriptions.get(commandId)!.add(subscriberId);

    // 返回取消订阅函数
    return () => {
      const subscribers = this.subscriptions.get(commandId);
      if (subscribers) {
        subscribers.delete(subscriberId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(commandId);
        }
      }
    };
  }

  // 获取命令状态
  getCommandState(commandId: string): CommandState | null {
    return this.states.get(commandId) || null;
  }

  // 获取所有命令状态
  getAllCommandStates(): Map<string, CommandState> {
    return new Map(this.states);
  }

  // 清理命令状态
  unregisterCommand(commandId: string): void {
    this.states.delete(commandId);
    this.subscriptions.delete(commandId);
    this.emit('commandUnregistered', { commandId });
  }

  // 批量更新状态
  batchUpdateStates(
    updates: Array<{
      commandId: string;
      updates: Partial<CommandState>;
      source?: string;
    }>
  ): void {
    for (const update of updates) {
      this.updateCommandState(update.commandId, update.updates, update.source);
    }
  }

  // 获取状态统计
  getStateStatistics(): {
    totalCommands: number;
    loadingCommands: number;
    errorCommands: number;
    activeSubscriptions: number;
  } {
    const states = Array.from(this.states.values());
    const totalSubscriptions = Array.from(this.subscriptions.values()).reduce(
      (total, subs) => total + subs.size,
      0
    );

    return {
      totalCommands: states.length,
      loadingCommands: states.filter((s) => s.loading).length,
      errorCommands: states.filter((s) => s.error !== null).length,
      activeSubscriptions: totalSubscriptions,
    };
  }
}
