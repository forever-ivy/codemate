import { EnhancedSlashCommand } from '../base/EnhancedSlashCommand.js';
import type { Application } from '../../application/Application.js';
import type { EventBus } from '../../services/EventBus.js';
import type { StatusDataCollector } from '../../services/StatusDataCollector.js';
import type React from 'react';

/**
 * Status命令
 *
 * 显示系统状态和统计信息
 */
export class StatusCommand extends EnhancedSlashCommand {
  name = 'status';
  description = 'Show system status and statistics';
  aliases: string[] = ['stat', 'info'];

  constructor(
    private eventBus: EventBus,
    private statusCollector: StatusDataCollector
  ) {
    super();
  }

  async execute(_args: string[], _app: Application): Promise<void> {
    // 触发显示状态管理器事件
    this.eventBus.emit('show_status_manager', {
      statusCollector: this.statusCollector,
    });
  }

  getUIComponent(): React.ComponentType<any> {
    // 动态导入状态管理器组件
    try {
      const { StatusManager } = require('../../ui/components/StatusManager.js');
      return StatusManager;
    } catch {
      // 如果导入失败，返回一个简单的占位符组件
      return () => null;
    }
  }

  async fetchData() {
    return await this.statusCollector.collectAllStatus();
  }

  getKeyboardShortcuts() {
    return [
      {
        key: 'r',
        description: 'Refresh data',
        handler: () => this.refreshData(),
        category: 'Actions',
      },
      {
        key: '1-5',
        description: 'Switch tabs',
        handler: () => {},
        category: 'Navigation',
      },
      {
        key: '←→',
        description: 'Navigate tabs',
        handler: () => {},
        category: 'Navigation',
      },
      {
        key: 'h',
        description: 'Toggle health details',
        handler: () => {},
        category: 'View',
      },
      {
        key: 's',
        description: 'Toggle system details',
        handler: () => {},
        category: 'View',
      },
      {
        key: 'q',
        description: 'Exit',
        handler: () => {},
        category: 'Actions',
      },
    ];
  }

  getMetadata() {
    return {
      title: 'System Status',
      description: 'Monitor system resources and application health',
      category: 'System',
      icon: '📊',
      color: 'blue',
      priority: 1,
    };
  }

  protected applyCustomFilters(data: any[], _filters: Record<string, any>): any[] {
    // Status命令不需要复杂的过滤逻辑
    return data;
  }

  protected getSearchableText(item: any): string {
    if (typeof item === 'string') return item;
    if (item.name) return item.name;
    if (item.title) return item.title;
    return JSON.stringify(item);
  }

  protected getSortValue(item: any, sortBy: string): any {
    return item[sortBy] || '';
  }
}
