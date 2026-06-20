import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import { SpecSystemManager } from '../../spec/system/SpecSystemManager.js';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { Paths } from '../../services/Paths.js';
import type {
  CreateProjectOptions,
  ProjectContext,
  ProjectMetadata,
} from '../../spec/system/types.js';

/**
 * 统一的 Spec 命令入口
 *
 * 用法：
 * /spec create <project-name>           # 创建新项目
 * /spec status [project-id]             # 查看项目状态
 * /spec workflow list                   # 列出可用工作流
 * /spec workflow run <workflow-name>    # 执行工作流
 * /spec system health                   # 查看系统健康状态
 * /spec system optimize                 # 优化系统性能
 * /spec projects                        # 列出所有项目
 */
export class SpecCommand extends SlashCommand {
  name = 'spec';
  description = 'Unified Spec system management';
  aliases = ['s'];

  private systemManager?: SpecSystemManager;

  async execute(args: string[], app: Application): Promise<void> {
    try {
      // 获取或初始化系统管理器
      await this.ensureSystemManager(app);

      if (args.length === 0) {
        this.showHelp();
        return;
      }

      const subcommand = args[0];
      const subArgs = args.slice(1);

      switch (subcommand) {
        case 'create':
          await this.handleCreate(subArgs);
          break;
        case 'status':
          await this.handleStatus(subArgs);
          break;
        case 'workflow':
          await this.handleWorkflow(subArgs);
          break;
        case 'system':
          await this.handleSystem(subArgs);
          break;
        case 'projects':
          await this.handleProjects(subArgs);
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          console.log(`❌ 未知子命令: ${subcommand}`);
          this.showHelp();
      }
    } catch (error) {
      console.error(
        '❌ Spec 命令执行失败:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // ===== 子命令处理器 =====

  /**
   * 处理项目创建
   */
  private async handleCreate(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('❌ 请提供项目名称');
      console.log('用法: /spec create <project-name> [options]');
      return;
    }

    const projectName = args[0];
    const options = this.parseCreateOptions(args.slice(1));

    console.log(`🚀 创建项目: ${projectName}`);

    const createOptions: CreateProjectOptions = {
      name: projectName,
      description: options.description || `${projectName} 项目`,
      path: options.path || process.cwd(),
      type: (options.type as ProjectMetadata['type']) || 'web',
      techStack: options.techStack || ['TypeScript', 'Node.js'],
      teamSize: (options.teamSize as ProjectMetadata['teamSize']) || 'small',
      complexity: (options.complexity as ProjectMetadata['complexity']) || 'medium',
      workflowTemplate: options.workflow,
      initOptions: {
        autoStartBrainstorm: options.autoStart || false,
        useDefaultTemplate: true,
        enableCache: true,
        enableMonitoring: true,
        notifications: {
          enabled: true,
          channels: ['console'],
          level: 'info',
          templates: new Map(),
        },
      },
    };

    const project = await this.systemManager!.createProject(createOptions);

    console.log(`✅ 项目创建成功: ${project.name} (${project.id})`);
    console.log(`📂 项目路径: ${project.path}`);
    console.log(`📊 项目状态: ${project.status}`);

    // 如果指定了工作流，显示执行状态
    if (options.workflow) {
      console.log(`🔄 工作流 "${options.workflow}" 正在执行...`);
    }
  }

  /**
   * 处理项目状态查询
   */
  private async handleStatus(args: string[]): Promise<void> {
    if (args.length === 0) {
      // 显示所有项目状态
      const projects = await this.systemManager!.listProjects();

      if (projects.length === 0) {
        console.log('📝 暂无项目');
        return;
      }

      console.log('📊 项目状态概览:');
      console.log('');

      for (const project of projects) {
        const statusIcon = this.getStatusIcon(project.status);
        console.log(`${statusIcon} ${project.name} (${project.id})`);
        console.log(`   状态: ${project.status}`);
        console.log(`   路径: ${project.path}`);
        console.log(`   更新: ${project.updatedAt.toLocaleString()}`);
        console.log('');
      }

      return;
    }

    const projectId = args[0];
    const project = await this.systemManager!.getProject(projectId);

    if (!project) {
      console.log(`❌ 项目不存在: ${projectId}`);
      return;
    }

    this.displayProjectDetails(project);
  }

  /**
   * 处理工作流相关命令
   */
  private async handleWorkflow(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('❌ 请提供工作流子命令');
      console.log('用法: /spec workflow <list|run> [options]');
      return;
    }

    const workflowCommand = args[0];
    const workflowArgs = args.slice(1);

    switch (workflowCommand) {
      case 'list':
        await this.listWorkflows();
        break;
      case 'run':
        await this.runWorkflow(workflowArgs);
        break;
      default:
        console.log(`❌ 未知工作流命令: ${workflowCommand}`);
    }
  }

  /**
   * 处理系统相关命令
   */
  private async handleSystem(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('❌ 请提供系统子命令');
      console.log('用法: /spec system <health|optimize|cache> [options]');
      return;
    }

    const systemCommand = args[0];

    switch (systemCommand) {
      case 'health':
        await this.showSystemHealth();
        break;
      case 'optimize':
        await this.optimizeSystem();
        break;
      case 'cache':
        await this.showCacheStatus();
        break;
      default:
        console.log(`❌ 未知系统命令: ${systemCommand}`);
    }
  }

  /**
   * 处理项目列表
   */
  private async handleProjects(_args: string[]): Promise<void> {
    const projects = await this.systemManager!.listProjects();

    if (projects.length === 0) {
      console.log('📝 暂无项目');
      return;
    }

    console.log(`📋 项目列表 (共 ${projects.length} 个):`);
    console.log('');

    for (const project of projects) {
      const statusIcon = this.getStatusIcon(project.status);
      const typeIcon = this.getTypeIcon(project.metadata.type);

      console.log(`${statusIcon} ${typeIcon} ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   状态: ${project.status}`);
      console.log(`   类型: ${project.metadata.type}`);
      console.log(`   技术栈: ${project.metadata.techStack.join(', ')}`);
      console.log(`   创建时间: ${project.createdAt.toLocaleString()}`);
      console.log('');
    }
  }

  // ===== 辅助方法 =====

  /**
   * 确保系统管理器已初始化
   */
  private async ensureSystemManager(app: Application): Promise<void> {
    if (this.systemManager) {
      return;
    }

    const eventBus = app.getContainer().get<EventBus>('eventBus');
    const modelService = app.getContainer().get<ModelService>('model');
    const paths = app.getContainer().get<Paths>('paths');

    this.systemManager = new SpecSystemManager(eventBus, modelService, paths);
    await this.systemManager.initialize();
  }

  /**
   * 解析创建选项
   */
  private parseCreateOptions(args: string[]): {
    description?: string;
    path?: string;
    type?: string;
    techStack?: string[];
    teamSize?: string;
    complexity?: string;
    workflow?: string;
    autoStart?: boolean;
  } {
    const options: any = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      switch (key) {
        case '--description':
        case '-d':
          options.description = value;
          break;
        case '--path':
        case '-p':
          options.path = value;
          break;
        case '--type':
        case '-t':
          options.type = value;
          break;
        case '--tech-stack':
          options.techStack = value.split(',');
          break;
        case '--team-size':
          options.teamSize = value;
          break;
        case '--complexity':
        case '-c':
          options.complexity = value;
          break;
        case '--workflow':
        case '-w':
          options.workflow = value;
          break;
        case '--auto-start':
          options.autoStart = true;
          i--; // 这是一个标志，不需要值
          break;
      }
    }

    return options;
  }

  /**
   * 显示项目详情
   */
  private displayProjectDetails(project: ProjectContext): void {
    const statusIcon = this.getStatusIcon(project.status);
    const typeIcon = this.getTypeIcon(project.metadata.type);

    console.log(`${statusIcon} ${typeIcon} ${project.name}`);
    console.log('');
    console.log('📋 基本信息:');
    console.log(`   ID: ${project.id}`);
    console.log(`   描述: ${project.description}`);
    console.log(`   路径: ${project.path}`);
    console.log(`   状态: ${project.status}`);
    console.log('');
    console.log('🔧 技术信息:');
    console.log(`   类型: ${project.metadata.type}`);
    console.log(`   技术栈: ${project.metadata.techStack.join(', ')}`);
    console.log(`   团队规模: ${project.metadata.teamSize}`);
    console.log(`   复杂度: ${project.metadata.complexity}`);
    console.log('');
    console.log('📅 时间信息:');
    console.log(`   创建时间: ${project.createdAt.toLocaleString()}`);
    console.log(`   更新时间: ${project.updatedAt.toLocaleString()}`);

    if (project.metadata.estimatedDuration) {
      console.log(`   预计工期: ${project.metadata.estimatedDuration} 天`);
    }

    console.log('');
    console.log('📊 关联数据:');
    console.log(`   规格文档: ${project.spec ? '✅' : '❌'}`);
    console.log(`   实施计划: ${project.plan ? '✅' : '❌'}`);
    console.log(`   执行会话: ${project.execution ? '✅' : '❌'}`);
    console.log(`   设计文档: ${project.designs.length} 个`);
  }

  /**
   * 列出工作流
   */
  private async listWorkflows(): Promise<void> {
    const workflows = this.systemManager!.getAvailableWorkflows();

    if (workflows.length === 0) {
      console.log('📝 暂无可用工作流');
      return;
    }

    console.log(`🔄 可用工作流 (共 ${workflows.length} 个):`);
    console.log('');

    for (const workflow of workflows) {
      console.log(`📋 ${workflow.name} (${workflow.id})`);
      console.log(`   描述: ${workflow.description}`);
      console.log(`   版本: ${workflow.version}`);
      console.log(`   步骤数: ${workflow.steps.length}`);
      console.log(`   前置条件: ${workflow.prerequisites.join(', ') || '无'}`);
      console.log('');
    }
  }

  /**
   * 运行工作流
   */
  private async runWorkflow(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('❌ 请提供工作流名称');
      console.log('用法: /spec workflow run <workflow-name> [project-id]');
      return;
    }

    const workflowName = args[0];
    const projectId = args[1];

    if (!projectId) {
      console.log('❌ 请提供项目ID');
      return;
    }

    const project = await this.systemManager!.getProject(projectId);
    if (!project) {
      console.log(`❌ 项目不存在: ${projectId}`);
      return;
    }

    console.log(`🚀 开始执行工作流: ${workflowName}`);
    console.log(`📂 项目: ${project.name} (${project.id})`);

    try {
      const result = await this.systemManager!.executeWorkflow(workflowName, { project });

      console.log(`✅ 工作流执行完成: ${result.status}`);
      console.log(`⏱️  执行时间: ${result.statistics.totalDuration}ms`);
      console.log(
        `📊 步骤统计: ${result.statistics.completedSteps}/${result.statistics.totalSteps} 完成`
      );

      if (result.error) {
        console.log(`❌ 错误信息: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ 工作流执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 显示系统健康状态
   */
  private async showSystemHealth(): Promise<void> {
    console.log('🔍 检查系统健康状态...');

    const health = await this.systemManager!.getSystemHealth();
    const statusIcon =
      health.status === 'healthy' ? '✅' : health.status === 'warning' ? '⚠️' : '❌';

    console.log(`${statusIcon} 系统状态: ${health.status}`);
    console.log(`🕐 检查时间: ${health.lastCheckTime.toLocaleString()}`);
    console.log('');

    console.log('📊 性能指标:');
    console.log(`   CPU 使用率: ${health.metrics.cpuUsage.toFixed(1)}%`);
    console.log(`   内存使用: ${health.metrics.memoryUsage.toFixed(1)} MB`);
    console.log(`   磁盘使用: ${health.metrics.diskUsage.toFixed(1)} MB`);
    console.log(`   响应时间: ${health.metrics.responseTime} ms`);
    console.log('');

    console.log('🔧 组件状态:');
    for (const [name, component] of health.components) {
      const componentIcon =
        component.status === 'healthy' ? '✅' : component.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${componentIcon} ${name}: ${component.message}`);
    }
  }

  /**
   * 优化系统性能
   */
  private async optimizeSystem(): Promise<void> {
    console.log('🔧 开始系统性能优化...');

    const results = await this.systemManager!.optimizePerformance();

    console.log(`✅ 性能优化完成，共 ${results.length} 项优化:`);
    console.log('');

    for (const result of results) {
      console.log(`🔧 ${result.type} 优化:`);
      console.log(`   改进: ${result.improvement.toFixed(1)}%`);
      console.log(`   建议: ${result.recommendations.join(', ')}`);
      console.log('');
    }
  }

  /**
   * 显示缓存状态
   */
  private async showCacheStatus(): Promise<void> {
    const cacheService = this.systemManager!.getCacheService();
    const stats = cacheService.getStatistics();
    const memoryUsage = cacheService.getMemoryUsage();

    console.log('🗄️  缓存状态:');
    console.log(`   条目数量: ${stats.totalEntries}`);
    console.log(`   命中率: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(
      `   内存使用: ${memoryUsage.used.toFixed(1)} MB / ${memoryUsage.total} MB (${memoryUsage.percentage.toFixed(1)}%)`
    );

    if (stats.oldestEntry) {
      console.log(`   最旧条目: ${stats.oldestEntry.toLocaleString()}`);
    }

    if (stats.newestEntry) {
      console.log(`   最新条目: ${stats.newestEntry.toLocaleString()}`);
    }

    console.log('');
    console.log('📊 内存分布:');
    for (const [category, size] of memoryUsage.breakdown) {
      console.log(`   ${category}: ${size.toFixed(1)} MB`);
    }
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      initializing: '🔄',
      brainstorming: '💭',
      planning: '📋',
      executing: '⚡',
      documenting: '📝',
      completed: '✅',
      paused: '⏸️',
      cancelled: '❌',
    };
    return icons[status] || '❓';
  }

  /**
   * 获取类型图标
   */
  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      web: '🌐',
      mobile: '📱',
      desktop: '💻',
      api: '🔌',
      library: '📚',
      other: '📦',
    };
    return icons[type] || '📦';
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log('🎯 Spec 系统统一命令');
    console.log('');
    console.log('用法: /spec <subcommand> [options]');
    console.log('');
    console.log('子命令:');
    console.log('  create <name>           创建新项目');
    console.log('  status [project-id]     查看项目状态');
    console.log('  workflow list           列出可用工作流');
    console.log('  workflow run <name>     执行工作流');
    console.log('  system health           查看系统健康状态');
    console.log('  system optimize         优化系统性能');
    console.log('  system cache            查看缓存状态');
    console.log('  projects                列出所有项目');
    console.log('  help                    显示帮助信息');
    console.log('');
    console.log('创建项目选项:');
    console.log('  --description, -d       项目描述');
    console.log('  --path, -p              项目路径');
    console.log('  --type, -t              项目类型 (web|mobile|desktop|api|library)');
    console.log('  --tech-stack            技术栈 (逗号分隔)');
    console.log('  --team-size             团队规模 (small|medium|large)');
    console.log('  --complexity, -c        项目复杂度 (low|medium|high)');
    console.log('  --workflow, -w          初始工作流');
    console.log('  --auto-start            自动开始头脑风暴');
    console.log('');
    console.log('示例:');
    console.log('  /spec create my-app --type web --workflow complete-project');
    console.log('  /spec status project-123');
    console.log('  /spec workflow run complete-project project-123');
    console.log('  /spec system health');
  }
}
