import { SlashCommand } from './SlashCommand.js';
import type { Application } from '../../application/Application.js';
import type React from 'react';

export interface CommandInteractionState {
  loading: boolean;
  data: any;
  error: string | null;
  selectedIndex: number;
  searchQuery: string;
  filters: Record<string, any>;
  viewMode?: 'list' | 'grid' | 'detail';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface KeyboardShortcut {
  key: string;
  description: string;
  handler: () => void;
  category?: string;
}

export interface CommandMetadata {
  title: string;
  description: string;
  category: string;
  icon?: string;
  color?: string;
  priority?: number;
}

export abstract class EnhancedSlashCommand extends SlashCommand {
  protected interactionState: CommandInteractionState = {
    loading: false,
    data: null,
    error: null,
    selectedIndex: 0,
    searchQuery: '',
    filters: {},
    viewMode: 'list',
    sortBy: 'name',
    sortOrder: 'asc',
  };

  // 抽象方法 - 子类必须实现
  abstract getUIComponent(): React.ComponentType<any>;
  abstract fetchData(): Promise<any>;
  abstract getKeyboardShortcuts(): KeyboardShortcut[];
  abstract getMetadata(): CommandMetadata;

  // 可选方法 - 子类可以重写
  subscribeToUpdates(): () => void {
    return () => {}; // 默认无订阅
  }

  validateData(data: any): boolean {
    return data !== null && data !== undefined;
  }

  transformData(rawData: any): any {
    return rawData; // 默认不转换
  }

  // 核心方法
  getInteractionState(): CommandInteractionState {
    return this.interactionState;
  }

  updateInteractionState(updates: Partial<CommandInteractionState>): void {
    this.interactionState = { ...this.interactionState, ...updates };
  }

  async refreshData(): Promise<void> {
    try {
      this.interactionState.loading = true;
      this.interactionState.error = null;

      const rawData = await this.fetchData();

      if (!this.validateData(rawData)) {
        throw new Error('Invalid data received');
      }

      const transformedData = this.transformData(rawData);
      this.interactionState.data = transformedData;
    } catch (error) {
      this.interactionState.error = error instanceof Error ? error.message : 'Unknown error';
      this.interactionState.data = null;
    } finally {
      this.interactionState.loading = false;
    }
  }

  // 启动命令UI
  protected async showCommandUI(app: Application): Promise<void> {
    const commandUIManager = app.getContainer().get('commandUI');
    await (commandUIManager as any).showUI(this);
  }

  // 通用过滤方法
  protected applyFilters(data: any[]): any[] {
    let filtered = [...data];

    // 搜索过滤
    if (this.interactionState.searchQuery) {
      filtered = this.applySearchFilter(filtered, this.interactionState.searchQuery);
    }

    // 自定义过滤器
    filtered = this.applyCustomFilters(filtered, this.interactionState.filters);

    // 排序
    filtered = this.applySorting(
      filtered,
      this.interactionState.sortBy || 'name',
      this.interactionState.sortOrder || 'asc'
    );

    return filtered;
  }

  protected applySearchFilter(data: any[], query: string): any[] {
    const lowerQuery = query.toLowerCase();
    return data.filter((item) => this.getSearchableText(item).toLowerCase().includes(lowerQuery));
  }

  protected applyCustomFilters(data: any[], _filters: Record<string, any>): any[] {
    return data; // 子类重写实现具体过滤逻辑
  }

  protected applySorting(data: any[], sortBy: string, sortOrder: 'asc' | 'desc'): any[] {
    return data.sort((a, b) => {
      const aValue = this.getSortValue(a, sortBy);
      const bValue = this.getSortValue(b, sortBy);

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  protected getSearchableText(item: any): string {
    // 默认实现，子类可以重写
    if (typeof item === 'string') return item;
    if (item.name) return item.name;
    if (item.title) return item.title;
    return JSON.stringify(item);
  }

  protected getSortValue(item: any, sortBy: string): any {
    // 默认实现，子类可以重写
    return item[sortBy] || '';
  }
}
