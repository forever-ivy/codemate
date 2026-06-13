import os from 'node:os';
import fs from 'node:fs/promises';
import type { SessionService } from './SessionService.js';
import type { ConfigService } from './ConfigService.js';
import type { MCPManager } from '../mcp/MCPManager.js';

export interface SystemInfo {
  platform: string;
  nodeVersion: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  loadAverage: number[];
}

export interface SessionStats {
  total: number;
  active: number;
  totalMessages: number;
  storageUsed: string;
  averageSessionLength: number;
  recentSessions: number;
  oldestSession: Date | null;
  newestSession: Date | null;
}

export interface ModelStats {
  currentModel: string;
  totalRequests: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  estimatedCost: number;
  averageResponseTime: number;
  errorRate: number;
  popularModels: Array<{
    name: string;
    usage: number;
    percentage: number;
  }>;
}

export type HealthStatus = 'healthy' | 'warning' | 'error';

export interface ComponentHealth {
  configService: HealthStatus;
  mcpServers: HealthStatus;
  eventBus: HealthStatus;
  sessionService: HealthStatus;
  toolManager: HealthStatus;
  overall: HealthStatus;
}

export interface PerformanceMetrics {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    messagesPerMinute: number;
  };
  errorRates: {
    total: number;
    byType: Record<string, number>;
  };
  resourceUsage: {
    memoryTrend: number[];
    cpuTrend: number[];
  };
}

export interface SystemStatus {
  system: SystemInfo;
  sessions: SessionStats;
  models: ModelStats;
  components: ComponentHealth;
  performance: PerformanceMetrics;
  timestamp: Date;
}

export class StatusDataCollector {
  private performanceHistory: {
    memory: number[];
    cpu: number[];
    responseTime: number[];
  } = {
    memory: [],
    cpu: [],
    responseTime: [],
  };

  constructor(
    private _sessionService: SessionService,
    private configService: ConfigService,
    private mcpManager: MCPManager
  ) {}

  async collectAllStatus(): Promise<SystemStatus> {
    const [system, sessions, models, components, performance] = await Promise.all([
      this.collectSystemInfo(),
      this.collectSessionStats(),
      this.collectModelStats(),
      this.checkComponentHealth(),
      this.collectPerformanceMetrics(),
    ]);

    return {
      system,
      sessions,
      models,
      components,
      performance,
      timestamp: new Date(),
    };
  }
  async collectSystemInfo(): Promise<SystemInfo> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const cpuUsage = await this.getCpuUsage();

    // 记录性能历史
    this.performanceHistory.memory.push((usedMem / totalMem) * 100);
    this.performanceHistory.cpu.push(cpuUsage);

    // 保持最近50个数据点
    if (this.performanceHistory.memory.length > 50) {
      this.performanceHistory.memory.shift();
      this.performanceHistory.cpu.shift();
    }

    return {
      platform: `${os.platform()} ${os.arch()}`,
      nodeVersion: process.version,
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
      },
      disk: await this.getDiskUsage(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const startUsage = process.cpuUsage();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const endUsage = process.cpuUsage(startUsage);

      const totalUsage = endUsage.user + endUsage.system;
      const percentage = totalUsage / 100000 / os.cpus().length;
      return Math.min(100, Math.max(0, percentage));
    } catch {
      return 0;
    }
  }

  private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
    try {
      // 简化实现，获取当前工作目录的磁盘使用情况
      await fs.stat(process.cwd());
      // 在实际实现中，应该使用更精确的磁盘空间检查
      return {
        used: 0,
        total: 0,
        percentage: 0,
      };
    } catch {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  async collectSessionStats(): Promise<SessionStats> {
    try {
      // 简化实现，因为SessionService可能没有listSessions方法
      // 在实际实现中应该从SessionService获取真实数据
      const sessions: any[] = []; // await this.sessionService.listSessions();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let totalMessages = 0;
      let totalStorageSize = 0;
      let oldestSession: Date | null = null;
      let newestSession: Date | null = null;
      let recentSessions = 0;

      for (const session of sessions) {
        const sessionDate = new Date(session.createdAt);

        // 统计消息数量
        if (session.messageCount) {
          totalMessages += session.messageCount;
        }

        // 统计存储大小
        if (session.size) {
          totalStorageSize += session.size;
        }

        // 找到最老和最新的会话
        if (!oldestSession || sessionDate < oldestSession) {
          oldestSession = sessionDate;
        }
        if (!newestSession || sessionDate > newestSession) {
          newestSession = sessionDate;
        }

        // 统计最近24小时的会话
        if (sessionDate > oneDayAgo) {
          recentSessions++;
        }
      }

      const averageSessionLength = sessions.length > 0 ? totalMessages / sessions.length : 0;
      const storageUsed = this.formatBytes(totalStorageSize);

      return {
        total: sessions.length,
        active: sessions.filter((s: any) => s.isActive).length,
        totalMessages,
        storageUsed,
        averageSessionLength: Math.round(averageSessionLength),
        recentSessions,
        oldestSession,
        newestSession,
      };
    } catch (error) {
      console.error('Failed to collect session stats:', error);
      return {
        total: 0,
        active: 0,
        totalMessages: 0,
        storageUsed: '0 B',
        averageSessionLength: 0,
        recentSessions: 0,
        oldestSession: null,
        newestSession: null,
      };
    }
  }

  async collectModelStats(): Promise<ModelStats> {
    try {
      // 从配置服务获取当前模型
      const config = this.configService.getConfig();
      const currentModel = config.model || 'Unknown';

      // 简化的模型统计实现
      // 在实际应用中，这些数据应该从使用日志或统计服务中获取
      return {
        currentModel,
        totalRequests: 0,
        totalTokens: {
          input: 0,
          output: 0,
          total: 0,
        },
        estimatedCost: 0,
        averageResponseTime: 0,
        errorRate: 0,
        popularModels: [{ name: currentModel, usage: 100, percentage: 100 }],
      };
    } catch (error) {
      console.error('Failed to collect model stats:', error);
      return {
        currentModel: 'Unknown',
        totalRequests: 0,
        totalTokens: { input: 0, output: 0, total: 0 },
        estimatedCost: 0,
        averageResponseTime: 0,
        errorRate: 0,
        popularModels: [],
      };
    }
  }

  async checkComponentHealth(): Promise<ComponentHealth> {
    const health: ComponentHealth = {
      configService: 'healthy',
      mcpServers: 'healthy',
      eventBus: 'healthy',
      sessionService: 'healthy',
      toolManager: 'healthy',
      overall: 'healthy',
    };

    try {
      // 检查配置服务
      this.configService.getConfig();
      health.configService = 'healthy';
    } catch {
      health.configService = 'error';
    }

    try {
      // 检查MCP服务器状态
      const mcpStatus = this.mcpManager.getServerStatus();
      const hasFailedServers = Object.values(mcpStatus.servers).some(
        (server: any) => server.status === 'failed' || server.status === 'disconnected'
      );
      health.mcpServers = hasFailedServers ? 'warning' : 'healthy';
    } catch {
      health.mcpServers = 'error';
    }

    try {
      // 检查事件总线（简单检查）
      health.eventBus = 'healthy';
    } catch {
      health.eventBus = 'error';
    }

    try {
      // 检查会话服务（简化实现）
      health.sessionService = 'healthy';
    } catch {
      health.sessionService = 'error';
    }

    // 计算整体健康状态
    const statuses = Object.values(health).filter((status) => status !== health.overall);
    if (statuses.includes('error')) {
      health.overall = 'error';
    } else if (statuses.includes('warning')) {
      health.overall = 'warning';
    } else {
      health.overall = 'healthy';
    }

    return health;
  }

  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return {
      responseTime: {
        average: this.calculateAverage(this.performanceHistory.responseTime),
        p95: this.calculatePercentile(this.performanceHistory.responseTime, 95),
        p99: this.calculatePercentile(this.performanceHistory.responseTime, 99),
      },
      throughput: {
        requestsPerSecond: 0, // 简化实现
        messagesPerMinute: 0, // 简化实现
      },
      errorRates: {
        total: 0,
        byType: {},
      },
      resourceUsage: {
        memoryTrend: [...this.performanceHistory.memory],
        cpuTrend: [...this.performanceHistory.cpu],
      },
    };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculatePercentile(numbers: number[], percentile: number): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // 记录响应时间（供其他组件调用）
  recordResponseTime(time: number): void {
    this.performanceHistory.responseTime.push(time);
    if (this.performanceHistory.responseTime.length > 100) {
      this.performanceHistory.responseTime.shift();
    }
  }
}
