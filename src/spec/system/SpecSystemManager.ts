import { nanoid } from 'nanoid';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { Paths } from '../../services/Paths.js';
import { SpecManager } from '../SpecManager.js';
import { PlanGenerator } from '../plan/PlanGenerator.js';
import { PlanManager } from '../plan/PlanManager.js';
import { PlanStorage } from '../plan/PlanStorage.js';
import { ExecutionTracker } from '../execution/ExecutionTracker.js';
import { TaskExecutor } from '../execution/TaskExecutor.js';
import { DesignDocumentGenerator } from '../design/DesignDocumentGenerator.js';
import { WorkflowManager } from './WorkflowManager.js';
import { CacheService } from './CacheService.js';
import { MonitorService } from './MonitorService.js';
import { EventService } from './EventService.js';
import type {
  ProjectContext,
  ProjectStatus,
  CreateProjectOptions,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowResult,
  SystemHealth,
  OptimizationResult,
} from './types.js';

/**
 * Spec 系统统一管理器
 *
 * 职责：
 * 1. 统一的系统入口点
 * 2. 组件生命周期管理
 * 3. 工作流协调和执行
 * 4. 性能监控和优化
 * 5. 错误处理和恢复
 * 6. 缓存和数据管理
 */
export class SpecSystemManager {
  // 核心组件
  private specManager: SpecManager;
  private planGenerator: PlanGenerator;
  private planStorage: PlanStorage;
  private planManager: PlanManager;
  private executionTracker: ExecutionTracker;
  private taskExecutor: TaskExecutor;
  private designGenerator: DesignDocumentGenerator;

  // 核心服务
  private workflowManager: WorkflowManager;
  private cacheService: CacheService;
  private monitorService: MonitorService;
  private eventService: EventService;

  // 系统状态
  private initialized = false;
  private projects = new Map<string, ProjectContext>();

  constructor(
    private eventBus: EventBus,
    private modelService: ModelService,
    private paths: Paths
  ) {
    // 初始化核心组件
    this.planStorage = new PlanStorage(paths);
    this.specManager = new SpecManager(eventBus, paths);
    this.planGenerator = new PlanGenerator(modelService);
    this.planManager = new PlanManager(this.planStorage, this.specManager, eventBus, modelService);
    this.executionTracker = new ExecutionTracker(eventBus);
    this.taskExecutor = new TaskExecutor(modelService, eventBus);
    this.designGenerator = new DesignDocumentGenerator(eventBus, modelService);

    // 初始化核心服务
    this.workflowManager = new WorkflowManager(this);
    this.cacheService = new CacheService();
    this.monitorService = new MonitorService(eventBus);
    this.eventService = new EventService(eventBus);
  }

  /**
   * 初始化系统
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🚀 初始化 Spec 系统...');

      // 1. 初始化核心组件
      await this.initializeComponents();

      // 2. 初始化核心服务
      await this.initializeServices();

      // 3. 注册预定义工作流
      await this.registerBuiltinWorkflows();

      // 4. 设置事件监听
      this.setupEventListeners();

      // 5. 启动监控服务
      await this.monitorService.start();

      this.initialized = true;
      console.log('✅ Spec 系统初始化完成');

      // 发送初始化完成事件
      this.eventBus.emit('spec_system_initialized', {
        timestamp: new Date(),
        components: this.getComponentStatus(),
      });
    } catch (error) {
      console.error('❌ Spec 系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭系统
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🔄 关闭 Spec 系统...');

      // 1. 停止监控服务
      await this.monitorService.stop();

      // 2. 保存所有项目状态
      await this.saveAllProjects();

      // 3. 清理缓存
      await this.cacheService.clear();

      // 4. 关闭组件
      await this.shutdownComponents();

      this.initialized = false;
      console.log('✅ Spec 系统已关闭');
    } catch (error) {
      console.error('❌ Spec 系统关闭失败:', error);
      throw error;
    }
  }

  // ===== 项目管理 =====

  /**
   * 创建新项目
   */
  async createProject(options: CreateProjectOptions): Promise<ProjectContext> {
    this.ensureInitialized();

    try {
      const projectId = nanoid();
      const now = new Date();

      // 创建项目上下文
      const project: ProjectContext = {
        id: projectId,
        name: options.name,
        description: options.description,
        path: options.path,
        status: 'initializing',
        designs: [],
        metadata: {
          type: options.type,
          techStack: options.techStack,
          teamSize: options.teamSize,
          complexity: options.complexity,
          tags: [],
          members: [],
        },
        createdAt: now,
        updatedAt: now,
      };

      // 保存项目
      this.projects.set(projectId, project);

      // 缓存项目数据
      await this.cacheService.set(`project:${projectId}`, project);

      // 预加载相关数据
      if (options.initOptions.enableCache) {
        await this.preloadProjectData(projectId);
      }

      // 发送项目创建事件
      this.eventBus.emit('project_created', {
        projectId,
        project,
        timestamp: now,
      });

      console.log(`✅ 项目创建成功: ${options.name} (${projectId})`);

      // 自动开始工作流
      if (options.workflowTemplate) {
        await this.executeWorkflow(options.workflowTemplate, { project });
      }

      return project;
    } catch (error) {
      console.error('❌ 创建项目失败:', error);
      throw error;
    }
  }

  /**
   * 获取项目
   */
  async getProject(projectId: string): Promise<ProjectContext | null> {
    this.ensureInitialized();

    // 先从缓存获取
    let project = await this.cacheService.get<ProjectContext>(`project:${projectId}`);

    if (!project) {
      // 从内存获取
      project = this.projects.get(projectId) || null;

      if (project) {
        // 更新缓存
        await this.cacheService.set(`project:${projectId}`, project);
      }
    }

    return project;
  }

  /**
   * 更新项目状态
   */
  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`项目不存在: ${projectId}`);
    }

    const oldStatus = project.status;
    project.status = status;
    project.updatedAt = new Date();

    // 更新缓存
    await this.cacheService.set(`project:${projectId}`, project);

    // 发送状态更新事件
    this.eventBus.emit('project_status_updated', {
      projectId,
      oldStatus,
      newStatus: status,
      timestamp: new Date(),
    });

    console.log(`📊 项目状态更新: ${project.name} ${oldStatus} → ${status}`);
  }

  /**
   * 列出所有项目
   */
  async listProjects(): Promise<ProjectContext[]> {
    this.ensureInitialized();
    return Array.from(this.projects.values());
  }

  // ===== 工作流管理 =====

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowName: string,
    context: Partial<WorkflowContext> & { project: ProjectContext }
  ): Promise<WorkflowResult> {
    this.ensureInitialized();

    try {
      console.log(`🔄 开始执行工作流: ${workflowName}`);

      // 更新项目状态
      await this.updateProjectStatus(context.project.id, 'executing');

      // 执行工作流
      const workflowContext = this.buildWorkflowContext(context);
      const result = await this.workflowManager.executeWorkflow(workflowName, workflowContext);

      // 根据结果更新项目状态
      if (result.status === 'completed') {
        await this.updateProjectStatus(context.project.id, 'completed');
      } else if (result.status === 'failed') {
        await this.updateProjectStatus(context.project.id, 'paused');
      }

      console.log(`✅ 工作流执行完成: ${workflowName} (${result.status})`);
      return result;
    } catch (error) {
      console.error(`❌ 工作流执行失败: ${workflowName}`, error);
      await this.updateProjectStatus(context.project.id, 'paused');
      throw error;
    }
  }

  /**
   * 获取可用工作流
   */
  getAvailableWorkflows(): WorkflowDefinition[] {
    this.ensureInitialized();
    return this.workflowManager.getAvailableWorkflows();
  }

  // ===== 系统监控 =====

  /**
   * 获取系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    this.ensureInitialized();
    return await this.monitorService.getSystemHealth();
  }

  /**
   * 优化系统性能
   */
  async optimizePerformance(): Promise<OptimizationResult[]> {
    this.ensureInitialized();

    const results: OptimizationResult[] = [];

    try {
      console.log('🔧 开始性能优化...');

      // 1. 缓存优化
      const cacheResult = await this.cacheService.optimize();
      results.push(cacheResult);

      // 2. 内存优化
      const memoryResult = await this.optimizeMemory();
      results.push(memoryResult);

      // 3. 数据预加载优化
      const preloadResult = await this.optimizePreloading();
      results.push(preloadResult);

      console.log(`✅ 性能优化完成，共 ${results.length} 项优化`);
      return results;
    } catch (error) {
      console.error('❌ 性能优化失败:', error);
      throw error;
    }
  }

  // ===== 组件访问器 =====

  /**
   * 获取 SpecManager
   */
  getSpecManager(): SpecManager {
    return this.specManager;
  }

  /**
   * 获取 PlanManager
   */
  getPlanManager(): PlanManager {
    return this.planManager;
  }

  /**
   * 获取 ExecutionTracker
   */
  getExecutionTracker(): ExecutionTracker {
    return this.executionTracker;
  }

  /**
   * 获取 DesignDocumentGenerator
   */
  getDesignGenerator(): DesignDocumentGenerator {
    return this.designGenerator;
  }

  /**
   * 获取 CacheService
   */
  getCacheService(): CacheService {
    return this.cacheService;
  }

  // ===== 私有方法 =====

  /**
   * 确保系统已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Spec 系统未初始化，请先调用 initialize()');
    }
  }

  private buildWorkflowContext(
    context: Partial<WorkflowContext> & { project: ProjectContext }
  ): WorkflowContext {
    return {
      project: context.project,
      userInput: context.userInput ?? {},
      environment: context.environment ?? {},
      options: context.options ?? {
        skipConfirmation: false,
        verbose: false,
        dryRun: false,
        concurrency: 1,
        timeout: 300000,
      },
    };
  }

  /**
   * 初始化核心组件
   */
  private async initializeComponents(): Promise<void> {
    await this.specManager.initialize();
    await this.planManager.initialize();
    // 其他组件初始化...
  }

  /**
   * 初始化核心服务
   */
  private async initializeServices(): Promise<void> {
    await this.cacheService.initialize();
    await this.monitorService.initialize();
    await this.eventService.initialize();
  }

  /**
   * 注册内置工作流
   */
  private async registerBuiltinWorkflows(): Promise<void> {
    // 注册完整项目工作流
    const completeProjectWorkflow: WorkflowDefinition = {
      id: 'complete-project',
      name: '完整项目工作流',
      description: '从头脑风暴到文档生成的完整项目流程',
      version: '1.0.0',
      steps: [
        {
          id: 'brainstorm',
          name: '头脑风暴',
          description: '进行项目需求头脑风暴',
          type: 'brainstorm',
          config: { parameters: {}, inputMapping: {}, outputMapping: {} },
          dependencies: [],
          optional: false,
        },
        {
          id: 'plan',
          name: '制定计划',
          description: '生成项目实施计划',
          type: 'plan',
          config: { parameters: {}, inputMapping: {}, outputMapping: {} },
          dependencies: ['brainstorm'],
          optional: false,
        },
        {
          id: 'execute',
          name: '执行计划',
          description: '执行项目实施计划',
          type: 'execute',
          config: { parameters: {}, inputMapping: {}, outputMapping: {} },
          dependencies: ['plan'],
          optional: false,
        },
        {
          id: 'document',
          name: '生成文档',
          description: '生成项目设计文档',
          type: 'document',
          config: { parameters: {}, inputMapping: {}, outputMapping: {} },
          dependencies: ['execute'],
          optional: true,
        },
      ],
      config: {
        autoExecute: false,
        allowParallel: false,
        continueOnFailure: false,
        notifications: {
          enabled: true,
          channels: ['console'],
          level: 'info',
          templates: new Map(),
        },
        cache: { enabled: true, ttl: 3600, maxSize: 100, strategy: 'lru' },
      },
      prerequisites: [],
      expectedOutcomes: ['完整的项目实施', '详细的设计文档'],
    };

    this.workflowManager.registerWorkflow(completeProjectWorkflow);
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听项目事件
    this.eventBus.on('project_created', (data) => {
      console.log(`📝 项目创建事件: ${data.project.name}`);
    });

    this.eventBus.on('project_status_updated', (data) => {
      console.log(`📊 项目状态更新: ${data.projectId} ${data.oldStatus} → ${data.newStatus}`);
    });

    // 监听工作流事件
    this.eventBus.on('workflow_started', (data) => {
      console.log(`🔄 工作流开始: ${data.workflowName}`);
    });

    this.eventBus.on('workflow_completed', (data) => {
      console.log(`✅ 工作流完成: ${data.workflowName}`);
    });

    // 监听系统事件
    this.eventBus.on('system_health_warning', (data) => {
      console.warn(`⚠️  系统健康警告: ${data.message}`);
    });
  }

  /**
   * 预加载项目数据
   */
  private async preloadProjectData(projectId: string): Promise<void> {
    // 预加载相关的规格文档、计划等数据
    // 这里可以根据项目类型和复杂度智能预加载
  }

  /**
   * 保存所有项目
   */
  private async saveAllProjects(): Promise<void> {
    for (const [projectId, project] of this.projects) {
      await this.cacheService.set(`project:${projectId}`, project, 86400); // 24小时
    }
  }

  /**
   * 关闭组件
   */
  private async shutdownComponents(): Promise<void> {
    // 关闭各个组件
    // 这里可以添加组件特定的清理逻辑
  }

  /**
   * 获取组件状态
   */
  private getComponentStatus(): Record<string, string> {
    return {
      specManager: 'initialized',
      planManager: 'initialized',
      executionTracker: 'initialized',
      designGenerator: 'initialized',
      workflowManager: 'initialized',
      cacheService: 'initialized',
      monitorService: 'initialized',
      eventService: 'initialized',
    };
  }

  /**
   * 优化内存使用
   */
  private async optimizeMemory(): Promise<OptimizationResult> {
    const before = await this.monitorService.getMemoryUsage();

    // 执行内存优化
    if (global.gc) {
      global.gc();
    }

    const after = await this.monitorService.getMemoryUsage();
    const improvement = ((before.used - after.used) / before.used) * 100;

    return {
      type: 'memory',
      before: { memoryUsage: before.used } as any,
      after: { memoryUsage: after.used } as any,
      improvement,
      recommendations: ['定期执行垃圾回收', '优化数据结构'],
      optimizedAt: new Date(),
    };
  }

  /**
   * 优化预加载
   */
  private async optimizePreloading(): Promise<OptimizationResult> {
    // 分析访问模式，优化预加载策略
    return {
      type: 'cache',
      before: {} as any,
      after: {} as any,
      improvement: 0,
      recommendations: ['优化预加载策略'],
      optimizedAt: new Date(),
    };
  }
}
