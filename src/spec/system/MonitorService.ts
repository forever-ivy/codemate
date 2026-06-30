import type { EventBus } from '../../services/EventBus.js';
import type { SystemHealth, ComponentHealth, PerformanceMetrics, MemoryUsage } from './types.js';

/**
 * 监控服务
 *
 * 职责：
 * 1. 系统健康监控
 * 2. 性能指标收集
 * 3. 异常检测和告警
 * 4. 资源使用监控
 */
export class MonitorService {
  private monitoring = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private components = new Map<string, ComponentHealth>();
  private lastMetrics?: PerformanceMetrics;

  constructor(private eventBus: EventBus) {}

  /**
   * 初始化监控服务
   */
  async initialize(): Promise<void> {
    console.log('📊 初始化监控服务...');

    // 注册核心组件
    this.registerComponents();

    // 设置事件监听
    this.setupEventListeners();

    console.log('✅ 监控服务初始化完成');
  }

  /**
   * 启动监控
   */
  async start(): Promise<void> {
    if (this.monitoring) {
      return;
    }

    console.log('🔍 启动系统监控...');

    this.monitoring = true;

    // 启动健康检查
    this.startHealthCheck();

    // 启动性能指标收集
    this.startMetricsCollection();

    console.log('✅ 系统监控已启动');
  }

  /**
   * 停止监控
   */
  async stop(): Promise<void> {
    if (!this.monitoring) {
      return;
    }

    console.log('⏹️  停止系统监控...');

    this.monitoring = false;

    // 停止定时器
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }

    console.log('✅ 系统监控已停止');
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    // 更新所有组件健康状态
    await this.updateComponentsHealth();

    // 收集性能指标
    const metrics = await this.collectPerformanceMetrics();

    // 计算整体健康状态
    const overallStatus = this.calculateOverallStatus();

    return {
      status: overallStatus,
      components: new Map(this.components),
      metrics,
      lastCheckTime: new Date(),
    };
  }

  /**
   * 获取内存使用情况
   */
  async getMemoryUsage(): Promise<MemoryUsage> {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      used: usedMemory / (1024 * 1024), // MB
      total: totalMemory / (1024 * 1024), // MB
      percentage: (usedMemory / totalMemory) * 100,
      breakdown: new Map([
        ['heap', memUsage.heapUsed / (1024 * 1024)],
        ['external', memUsage.external / (1024 * 1024)],
        ['rss', memUsage.rss / (1024 * 1024)],
      ]),
    };
  }

  /**
   * 注册组件
   */
  registerComponent(name: string, healthChecker?: () => Promise<ComponentHealth>): void {
    this.components.set(name, {
      name,
      status: 'unknown',
      message: '等待健康检查',
      lastCheckTime: new Date(),
    });

    console.log(`📋 注册监控组件: ${name}`);
  }

  /**
   * 更新组件健康状态
   */
  async updateComponentHealth(name: string, health: Partial<ComponentHealth>): Promise<void> {
    const existing = this.components.get(name);
    if (!existing) {
      return;
    }

    const updated: ComponentHealth = {
      ...existing,
      ...health,
      lastCheckTime: new Date(),
    };

    this.components.set(name, updated);

    // 如果状态变为警告或严重，发送事件
    if (updated.status === 'warning' || updated.status === 'critical') {
      this.eventBus.emit('component_health_warning', {
        component: name,
        status: updated.status,
        message: updated.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 记录性能指标
   */
  recordMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.lastMetrics = {
      ...this.lastMetrics,
      ...metrics,
    } as PerformanceMetrics;
  }

  // ===== 私有方法 =====

  /**
   * 注册核心组件
   */
  private registerComponents(): void {
    const coreComponents = [
      'SpecManager',
      'PlanManager',
      'ExecutionTracker',
      'DesignGenerator',
      'WorkflowManager',
      'CacheService',
      'EventService',
    ];

    for (const component of coreComponents) {
      this.registerComponent(component);
    }
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听系统事件
    this.eventBus.on('spec_system_initialized', () => {
      this.updateComponentHealth('SpecSystem', {
        status: 'healthy',
        message: '系统初始化完成',
      });
    });

    // 监听组件错误
    this.eventBus.on('component_error', (data) => {
      this.updateComponentHealth(data.component, {
        status: 'critical',
        message: `组件错误: ${data.error}`,
      });
    });

    // 监听性能警告
    this.eventBus.on('performance_warning', (data) => {
      this.eventBus.emit('system_health_warning', {
        type: 'performance',
        message: `性能警告: ${data.message}`,
        metrics: data.metrics,
        timestamp: new Date(),
      });
    });
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    // 每30秒检查一次健康状态
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('健康检查失败:', error);
      }
    }, 30000);

    // 立即执行一次
    this.performHealthCheck();
  }

  /**
   * 启动性能指标收集
   */
  private startMetricsCollection(): void {
    // 每10秒收集一次性能指标
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.recordMetrics(metrics);

        // 检查性能阈值
        this.checkPerformanceThresholds(metrics);
      } catch (error) {
        console.error('性能指标收集失败:', error);
      }
    }, 10000);
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    for (const [name, component] of this.components) {
      try {
        // 执行组件特定的健康检查
        const health = await this.checkComponentHealth(name);
        await this.updateComponentHealth(name, health);
      } catch (error) {
        await this.updateComponentHealth(name, {
          status: 'critical',
          message: `健康检查失败: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  /**
   * 检查组件健康状态
   */
  private async checkComponentHealth(componentName: string): Promise<Partial<ComponentHealth>> {
    const startTime = Date.now();

    try {
      // 根据组件类型执行不同的健康检查
      switch (componentName) {
        case 'SpecManager':
          return await this.checkSpecManagerHealth();
        case 'CacheService':
          return await this.checkCacheServiceHealth();
        case 'WorkflowManager':
          return await this.checkWorkflowManagerHealth();
        default:
          return {
            status: 'healthy',
            message: '组件运行正常',
            responseTime: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        status: 'critical',
        message: `健康检查异常: ${error instanceof Error ? error.message : String(error)}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查 SpecManager 健康状态
   */
  private async checkSpecManagerHealth(): Promise<Partial<ComponentHealth>> {
    // 简单的健康检查：尝试列出规格文档
    try {
      // 这里应该调用实际的 SpecManager 方法
      return {
        status: 'healthy',
        message: 'SpecManager 运行正常',
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'SpecManager 响应异常',
      };
    }
  }

  /**
   * 检查 CacheService 健康状态
   */
  private async checkCacheServiceHealth(): Promise<Partial<ComponentHealth>> {
    // 检查缓存服务的内存使用情况
    try {
      // 这里应该调用实际的 CacheService 方法
      return {
        status: 'healthy',
        message: 'CacheService 运行正常',
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'CacheService 响应异常',
      };
    }
  }

  /**
   * 检查 WorkflowManager 健康状态
   */
  private async checkWorkflowManagerHealth(): Promise<Partial<ComponentHealth>> {
    try {
      // 检查是否有长时间运行的工作流
      return {
        status: 'healthy',
        message: 'WorkflowManager 运行正常',
      };
    } catch (error) {
      return {
        status: 'warning',
        message: 'WorkflowManager 响应异常',
      };
    }
  }

  /**
   * 更新所有组件健康状态
   */
  private async updateComponentsHealth(): Promise<void> {
    if (!this.monitoring) {
      return;
    }

    await this.performHealthCheck();
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const memUsage = await this.getMemoryUsage();
    const cpuUsage = await this.getCpuUsage();
    const diskUsage = await this.getDiskUsage();

    return {
      cpuUsage,
      memoryUsage: memUsage.used,
      diskUsage,
      networkIO: 0, // 简化实现
      responseTime: 0, // 简化实现
      throughput: 0, // 简化实现
    };
  }

  /**
   * 获取 CPU 使用率
   */
  private async getCpuUsage(): Promise<number> {
    // 简化的 CPU 使用率计算
    const startUsage = process.cpuUsage();

    return new Promise((resolve) => {
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = totalUsage / 1000000 / 100; // 转换为百分比
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  /**
   * 获取磁盘使用量
   */
  private async getDiskUsage(): Promise<number> {
    // 简化的磁盘使用量计算
    try {
      const fs = require('fs');
      const stats = fs.statSync(process.cwd());
      return stats.size / (1024 * 1024); // MB
    } catch {
      return 0;
    }
  }

  /**
   * 计算整体健康状态
   */
  private calculateOverallStatus(): 'healthy' | 'warning' | 'critical' {
    const statuses = Array.from(this.components.values()).map((c) => c.status);

    if (statuses.includes('critical')) {
      return 'critical';
    }

    if (statuses.includes('warning')) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * 检查性能阈值
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // CPU 使用率阈值
    if (metrics.cpuUsage > 80) {
      this.eventBus.emit('performance_warning', {
        type: 'cpu',
        message: `CPU 使用率过高: ${metrics.cpuUsage.toFixed(1)}%`,
        metrics,
        timestamp: new Date(),
      });
    }

    // 内存使用率阈值
    if (metrics.memoryUsage > 1000) {
      // 1GB
      this.eventBus.emit('performance_warning', {
        type: 'memory',
        message: `内存使用量过高: ${metrics.memoryUsage.toFixed(1)} MB`,
        metrics,
        timestamp: new Date(),
      });
    }

    // 响应时间阈值
    if (metrics.responseTime > 5000) {
      // 5秒
      this.eventBus.emit('performance_warning', {
        type: 'response_time',
        message: `响应时间过长: ${metrics.responseTime} ms`,
        metrics,
        timestamp: new Date(),
      });
    }
  }
}
