import React from 'react';
import { render } from 'ink';
import { EventEmitter } from 'events';
import type { EnhancedSlashCommand } from '../../commands/base/EnhancedSlashCommand.js';
import { CommandUIBase } from '../components/CommandUIBase.js';

export interface UISession {
  id: string;
  command: EnhancedSlashCommand;
  component: any;
  startTime: Date;
  lastActivity: Date;
}

export class CommandUIManager extends EventEmitter {
  private activeSessions = new Map<string, UISession>();
  private currentSession: UISession | null = null;

  async showUI(command: EnhancedSlashCommand): Promise<void> {
    const sessionId = this.generateSessionId();

    try {
      // 初始化命令数据
      await command.refreshData();

      // 创建UI会话
      const session = await this.createUISession(sessionId, command);
      this.activeSessions.set(sessionId, session);
      this.currentSession = session;

      // 发出事件
      this.emit('sessionStarted', session);

      // 等待UI关闭
      await this.waitForSessionEnd(sessionId);
    } catch (error) {
      this.emit('sessionError', { sessionId, error });
      throw error;
    } finally {
      // 清理会话
      this.cleanupSession(sessionId);
    }
  }

  private async createUISession(
    sessionId: string,
    command: EnhancedSlashCommand
  ): Promise<UISession> {
    const metadata = command.getMetadata();
    const shortcuts = command.getKeyboardShortcuts();
    const state = command.getInteractionState();

    // 创建UI组件
    const uiComponent = React.createElement(CommandUIBase, {
      metadata,
      data: state.data || [],
      loading: state.loading,
      error: state.error,
      selectedIndex: state.selectedIndex,
      searchQuery: state.searchQuery,
      filters: state.filters,
      viewMode: state.viewMode || 'list',
      shortcuts,

      // 事件处理器
      onSelect: (item: any, index: number) => this.handleItemSelect(sessionId, item, index),
      onSearch: (query: string) => this.handleSearch(sessionId, query),
      onFilter: (filters: Record<string, any>) => this.handleFilter(sessionId, filters),
      onViewModeChange: (mode: 'list' | 'grid' | 'detail') =>
        this.handleViewModeChange(sessionId, mode),
      onExit: () => this.handleExit(sessionId),

      // 渲染函数
      renderItem: (item: any, index: number, selected: boolean) =>
        this.renderCommandItem(command, item, index, selected),
      renderDetail: (item: any) => this.renderCommandDetail(command, item),
      renderEmpty: () => this.renderCommandEmpty(command),
      renderError: (error: string) => this.renderCommandError(command, error),
      renderLoading: () => this.renderCommandLoading(command),
    });

    // 渲染UI
    const inkInstance = render(uiComponent);

    // 订阅数据更新
    const unsubscribe = command.subscribeToUpdates();

    const session: UISession = {
      id: sessionId,
      command,
      component: inkInstance,
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // 设置清理函数
    (session.component as any).cleanup = () => {
      unsubscribe();
      inkInstance.unmount();
    };

    return session;
  }

  private async handleItemSelect(sessionId: string, item: any, index: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.command.updateInteractionState({ selectedIndex: index });

    // 发出选择事件
    this.emit('itemSelected', { sessionId, item, index });

    // 执行命令特定的选择逻辑
    await this.executeCommandAction(session.command, 'select', item);
  }

  private async handleSearch(sessionId: string, query: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.command.updateInteractionState({ searchQuery: query, selectedIndex: 0 });

    // 重新获取过滤后的数据
    await session.command.refreshData();

    this.emit('searchChanged', { sessionId, query });
  }

  private async handleFilter(sessionId: string, filters: Record<string, any>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.command.updateInteractionState({ filters, selectedIndex: 0 });

    // 重新获取过滤后的数据
    await session.command.refreshData();

    this.emit('filtersChanged', { sessionId, filters });
  }

  private async handleViewModeChange(
    sessionId: string,
    mode: 'list' | 'grid' | 'detail'
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.command.updateInteractionState({ viewMode: mode });

    this.emit('viewModeChanged', { sessionId, mode });
  }

  private handleExit(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    this.emit('sessionEnding', { sessionId });

    // 关闭UI
    if (session.component && (session.component as any).cleanup) {
      (session.component as any).cleanup();
    }

    this.activeSessions.delete(sessionId);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }

    this.emit('sessionEnded', { sessionId });
  }

  private async executeCommandAction(
    command: EnhancedSlashCommand,
    action: string,
    data?: any
  ): Promise<void> {
    try {
      // 这里可以根据命令类型执行不同的动作
      const methodName = `handle${action.charAt(0).toUpperCase() + action.slice(1)}`;
      if (typeof (command as any)[methodName] === 'function') {
        await (command as any)[methodName](data);
      }
    } catch (error) {
      this.emit('actionError', { command: command.name, action, error });
    }
  }

  private renderCommandItem(
    command: EnhancedSlashCommand,
    item: any,
    index: number,
    selected: boolean
  ): React.ReactNode {
    // 默认渲染逻辑，命令可以重写
    if (typeof (command as any).renderItem === 'function') {
      return (command as any).renderItem(item, index, selected);
    }

    // 通用渲染逻辑
    return React.createElement('div', { key: index }, JSON.stringify(item));
  }

  private renderCommandDetail(command: EnhancedSlashCommand, item: any): React.ReactNode {
    if (typeof (command as any).renderDetail === 'function') {
      return (command as any).renderDetail(item);
    }
    return null;
  }

  private renderCommandEmpty(command: EnhancedSlashCommand): React.ReactNode {
    if (typeof (command as any).renderEmpty === 'function') {
      return (command as any).renderEmpty();
    }
    return null;
  }

  private renderCommandError(command: EnhancedSlashCommand, error: string): React.ReactNode {
    if (typeof (command as any).renderError === 'function') {
      return (command as any).renderError(error);
    }
    return null;
  }

  private renderCommandLoading(command: EnhancedSlashCommand): React.ReactNode {
    if (typeof (command as any).renderLoading === 'function') {
      return (command as any).renderLoading();
    }
    return null;
  }

  private generateSessionId(): string {
    return `ui-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async waitForSessionEnd(sessionId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkSession = () => {
        if (!this.activeSessions.has(sessionId)) {
          resolve();
        } else {
          setTimeout(checkSession, 100);
        }
      };
      checkSession();
    });
  }

  private cleanupSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session && session.component && (session.component as any).cleanup) {
      (session.component as any).cleanup();
    }
    this.activeSessions.delete(sessionId);
  }

  // 公共方法
  getCurrentSession(): UISession | null {
    return this.currentSession;
  }

  getActiveSessions(): UISession[] {
    return Array.from(this.activeSessions.values());
  }

  closeAllSessions(): void {
    for (const sessionId of this.activeSessions.keys()) {
      this.handleExit(sessionId);
    }
  }
}
