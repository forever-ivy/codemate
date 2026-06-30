import type { EventBus } from '../../services/EventBus.js';
import type {
  NotificationConfig,
  NotificationChannel,
  NotificationLevel,
  NotificationTemplate,
} from './types.js';

/**
 * 事件服务
 *
 * 职责：
 * 1. 统一事件处理
 * 2. 事件路由和分发
 * 3. 通知管理
 * 4. 事件日志记录
 */
export class EventService {
  private eventHandlers = new Map<string, EventHandler[]>();
  private notificationConfig: NotificationConfig;
  private eventLog: EventLogEntry[] = [];
  private maxLogSize = 1000;

  constructor(private eventBus: EventBus) {
    this.notificationConfig = {
      enabled: true,
      channels: ['console'],
      level: 'info',
      templates: new Map(),
    };
  }

  /**
   * 初始化事件服务
   */
  async initialize(): Promise<void> {
    console.log('📡 初始化事件服务...');

    // 设置默认事件处理器
    this.setupDefaultHandlers();

    // 设置通知模板
    this.setupNotificationTemplates();

    // 开始监听事件总线
    this.startEventListening();

    console.log('✅ 事件服务初始化完成');
  }

  /**
   * 注册事件处理器
   */
  registerHandler(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);
    console.log(`📋 注册事件处理器: ${eventType}`);
  }

  /**
   * 取消注册事件处理器
   */
  unregisterHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers) {
      return;
    }

    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      console.log(`🗑️  取消注册事件处理器: ${eventType}`);
    }
  }

  /**
   * 发送事件
   */
  async emitEvent(eventType: string, data: any): Promise<void> {
    // 记录事件日志
    this.logEvent(eventType, data);

    // 通过事件总线发送
    this.eventBus.emit(eventType, data);

    // 执行本地处理器
    await this.executeHandlers(eventType, data);

    // 发送通知
    await this.sendNotification(eventType, data);
  }

  /**
   * 配置通知
   */
  configureNotifications(config: Partial<NotificationConfig>): void {
    this.notificationConfig = {
      ...this.notificationConfig,
      ...config,
    };

    console.log('📢 更新通知配置');
  }

  /**
   * 获取事件日志
   */
  getEventLog(limit?: number): EventLogEntry[] {
    const logLimit = limit || 100;
    return this.eventLog.slice(-logLimit);
  }

  /**
   * 清空事件日志
   */
  clearEventLog(): void {
    this.eventLog = [];
    console.log('🗑️  清空事件日志');
  }

  /**
   * 获取事件统计
   */
  getEventStatistics(): EventStatistics {
    const eventCounts = new Map<string, number>();
    const recentEvents = this.eventLog.slice(-100);

    for (const entry of recentEvents) {
      const count = eventCounts.get(entry.eventType) || 0;
      eventCounts.set(entry.eventType, count + 1);
    }

    return {
      totalEvents: this.eventLog.length,
      recentEvents: recentEvents.length,
      eventTypes: eventCounts,
      lastEventTime:
        this.eventLog.length > 0 ? this.eventLog[this.eventLog.length - 1].timestamp : null,
    };
  }

  // ===== 私有方法 =====

  /**
   * 设置默认事件处理器
   */
  private setupDefaultHandlers(): void {
    // 项目事件处理器
    this.registerHandler('project_created', async (data) => {
      console.log(`🎉 项目创建: ${data.project.name}`);
    });

    this.registerHandler('project_status_updated', async (data) => {
      console.log(`📊 项目状态更新: ${data.projectId} ${data.oldStatus} → ${data.newStatus}`);
    });

    // 工作流事件处理器
    this.registerHandler('workflow_started', async (data) => {
      console.log(`🚀 工作流开始: ${data.workflowName}`);
    });

    this.registerHandler('workflow_completed', async (data) => {
      console.log(`✅ 工作流完成: ${data.workflowName} (${data.duration}ms)`);
    });

    this.registerHandler('workflow_failed', async (data) => {
      console.error(`❌ 工作流失败: ${data.workflowName} - ${data.error}`);
    });

    // 系统事件处理器
    this.registerHandler('system_health_warning', async (data) => {
      console.warn(`⚠️  系统健康警告: ${data.message}`);
    });

    this.registerHandler('performance_warning', async (data) => {
      console.warn(`⚠️  性能警告: ${data.message}`);
    });

    // 组件事件处理器
    this.registerHandler('component_health_warning', async (data) => {
      console.warn(`⚠️  组件健康警告: ${data.component} - ${data.message}`);
    });

    // 错误事件处理器
    this.registerHandler('component_error', async (data) => {
      console.error(`💥 组件错误: ${data.component} - ${data.error}`);
    });
  }

  /**
   * 设置通知模板
   */
  private setupNotificationTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'project_created',
        name: '项目创建通知',
        titleTemplate: '新项目创建',
        contentTemplate: '项目 "{{project.name}}" 已成功创建',
        supportedChannels: ['console', 'email'],
      },
      {
        id: 'workflow_completed',
        name: '工作流完成通知',
        titleTemplate: '工作流完成',
        contentTemplate: '工作流 "{{workflowName}}" 已完成，耗时 {{duration}}ms',
        supportedChannels: ['console', 'slack'],
      },
      {
        id: 'system_warning',
        name: '系统警告通知',
        titleTemplate: '系统警告',
        contentTemplate: '系统警告: {{message}}',
        supportedChannels: ['console', 'email', 'slack'],
      },
      {
        id: 'error_notification',
        name: '错误通知',
        titleTemplate: '系统错误',
        contentTemplate: '发生错误: {{error}}',
        supportedChannels: ['console', 'email', 'slack', 'webhook'],
      },
    ];

    for (const template of templates) {
      this.notificationConfig.templates.set(template.id, template);
    }
  }

  /**
   * 开始监听事件总线
   */
  private startEventListening(): void {
    // 监听所有事件并记录日志
    const originalEmit = this.eventBus.emit.bind(this.eventBus);

    this.eventBus.emit = (eventType: string, data: any) => {
      this.logEvent(eventType, data);
      return originalEmit(eventType, data);
    };
  }

  /**
   * 记录事件日志
   */
  private logEvent(eventType: string, data: any): void {
    const entry: EventLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      data,
      timestamp: new Date(),
      level: this.getEventLevel(eventType),
    };

    this.eventLog.push(entry);

    // 限制日志大小
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize * 0.8);
    }
  }

  /**
   * 执行事件处理器
   */
  private async executeHandlers(eventType: string, data: any): Promise<void> {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers || handlers.length === 0) {
      return;
    }

    // 并行执行所有处理器
    const promises = handlers.map(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`事件处理器执行失败 (${eventType}):`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * 发送通知
   */
  private async sendNotification(eventType: string, data: any): Promise<void> {
    if (!this.notificationConfig.enabled) {
      return;
    }

    const eventLevel = this.getEventLevel(eventType);
    if (!this.shouldNotify(eventLevel)) {
      return;
    }

    const template = this.getNotificationTemplate(eventType);
    if (!template) {
      return;
    }

    const notification = this.buildNotification(template, data);

    for (const channel of this.notificationConfig.channels) {
      if (template.supportedChannels.includes(channel)) {
        await this.sendNotificationToChannel(channel, notification);
      }
    }
  }

  /**
   * 获取事件级别
   */
  private getEventLevel(eventType: string): NotificationLevel {
    if (
      eventType.includes('error') ||
      eventType.includes('failed') ||
      eventType.includes('critical')
    ) {
      return 'error';
    }

    if (eventType.includes('warning')) {
      return 'warning';
    }

    if (
      eventType.includes('completed') ||
      eventType.includes('created') ||
      eventType.includes('updated')
    ) {
      return 'info';
    }

    return 'debug';
  }

  /**
   * 判断是否应该发送通知
   */
  private shouldNotify(eventLevel: NotificationLevel): boolean {
    const levelPriority = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3,
      critical: 4,
    };

    const configLevel = levelPriority[this.notificationConfig.level];
    const eventLevelPriority = levelPriority[eventLevel];

    return eventLevelPriority >= configLevel;
  }

  /**
   * 获取通知模板
   */
  private getNotificationTemplate(eventType: string): NotificationTemplate | null {
    // 直接匹配
    let template = this.notificationConfig.templates.get(eventType);
    if (template) {
      return template;
    }

    // 模糊匹配
    if (eventType.includes('warning')) {
      template = this.notificationConfig.templates.get('system_warning');
    } else if (eventType.includes('error') || eventType.includes('failed')) {
      template = this.notificationConfig.templates.get('error_notification');
    }

    return template || null;
  }

  /**
   * 构建通知内容
   */
  private buildNotification(template: NotificationTemplate, data: any): Notification {
    const title = this.renderTemplate(template.titleTemplate, data);
    const content = this.renderTemplate(template.contentTemplate, data);

    return {
      title,
      content,
      timestamp: new Date(),
      data,
    };
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: string, data: any): string {
    let result = template;

    // 简单的模板渲染，支持 {{key}} 和 {{object.key}} 格式
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (!matches) {
      return result;
    }

    for (const match of matches) {
      const key = match.slice(2, -2).trim();
      const value = this.getNestedValue(data, key);
      result = result.replace(match, String(value || ''));
    }

    return result;
  }

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * 发送通知到指定渠道
   */
  private async sendNotificationToChannel(
    channel: NotificationChannel,
    notification: Notification
  ): Promise<void> {
    switch (channel) {
      case 'console':
        this.sendConsoleNotification(notification);
        break;
      case 'email':
        await this.sendEmailNotification(notification);
        break;
      case 'slack':
        await this.sendSlackNotification(notification);
        break;
      case 'webhook':
        await this.sendWebhookNotification(notification);
        break;
    }
  }

  /**
   * 发送控制台通知
   */
  private sendConsoleNotification(notification: Notification): void {
    console.log(`📢 ${notification.title}: ${notification.content}`);
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    // 邮件通知实现（简化）
    console.log(`📧 邮件通知: ${notification.title}`);
  }

  /**
   * 发送 Slack 通知
   */
  private async sendSlackNotification(notification: Notification): Promise<void> {
    // Slack 通知实现（简化）
    console.log(`💬 Slack 通知: ${notification.title}`);
  }

  /**
   * 发送 Webhook 通知
   */
  private async sendWebhookNotification(notification: Notification): Promise<void> {
    // Webhook 通知实现（简化）
    console.log(`🔗 Webhook 通知: ${notification.title}`);
  }
}

// ===== 类型定义 =====

/**
 * 事件处理器
 */
type EventHandler = (data: any) => Promise<void> | void;

/**
 * 事件日志条目
 */
interface EventLogEntry {
  id: string;
  eventType: string;
  data: any;
  timestamp: Date;
  level: NotificationLevel;
}

/**
 * 事件统计
 */
interface EventStatistics {
  totalEvents: number;
  recentEvents: number;
  eventTypes: Map<string, number>;
  lastEventTime: Date | null;
}

/**
 * 通知
 */
interface Notification {
  title: string;
  content: string;
  timestamp: Date;
  data: any;
}
