import type { ConfigManager } from '../config/ConfigManager'; // 🔥 新增
import { ToolManager } from '../managers/ToolManager';
import { ConfigService } from '../services/ConfigService'; // 新增
import { EventBus } from '../services/EventBus';
import { ModelService } from '../services/ModelService';
import { Paths } from '../services/Paths';
import { SessionService } from '../services/SessionService';
import { ToolTraceService } from '../tools/ToolTraceService';
import { DeleteFileTool } from '../tools/file/DeleteFileTool';
import { EditFileTool } from '../tools/file/EditFileTool';
import { ListFilesTool } from '../tools/file/ListFilesTool';
// 在文件顶部添加所有工具的导入
import { ReadFileTool } from '../tools/file/ReadFileTool';
import { WriteFileTool } from '../tools/file/WriteFileTool';
import { AskUserTool } from '../tools/interactive/AskUserTool';
import { ConfirmTool } from '../tools/interactive/ConfirmTool';
import { FetchTool } from '../tools/network/FetchTool';
import { WebSearchTool } from '../tools/network/WebSearchTool';
import { GlobTool } from '../tools/search/GlobTool';
import { GrepTool } from '../tools/search/GrepTool';
import { ExitPlanTool } from '../tools/special/ExitPlanTool';
import { SkillTool } from '../tools/special/SkillTool';
import { BashTool } from '../tools/system/BashTool';
import { EnvTool } from '../tools/system/EnvTool';
import { ExecTool } from '../tools/system/ExecTool';
import { TaskTool } from '../tools/task/TaskTool';
import { TodoReadTool } from '../tools/task/TodoReadTool';
import { TodoWriteTool } from '../tools/task/TodoWriteTool';
import type { ModelConfig } from '../types/index';
import { Container } from './Container';

import { ConfigCommand } from '../commands/config/ConfigCommand';
import { MCPCommand } from '../commands/mcp/MCPCommand';
import { EnhancedModelCommand } from '../commands/model/EnhancedModelCommand';
import { ReviewCommand } from '../commands/review/ReviewCommand';
import { ClearCommand } from '../commands/session/ClearCommand';
import { CompactCommand } from '../commands/session/CompactCommand';
import { EnhancedHelpCommand } from '../commands/session/EnhancedHelpCommand';
import { ExitCommand } from '../commands/session/ExitCommand';
import { ForkCommand } from '../commands/session/ForkCommand';
import { ResumeCommand } from '../commands/session/ResumeCommand';
import { RewindCommand } from '../commands/session/RewindCommand';
import { SessionsCommand } from '../commands/session/SessionsCommand';
import { SnapshotsCommand } from '../commands/snapshot/SnapshotsCommand';
import { SpecBrainstormCommand } from '../commands/spec/SpecBrainstormCommand';
import { SpecCommand } from '../commands/spec/SpecCommand';
import { SpecExecutePlanCommand } from '../commands/spec/SpecExecutePlanCommand';
import { SpecWritePlanCommand } from '../commands/spec/SpecWritePlanCommand';
import { StatusCommand } from '../commands/system/StatusCommand';
import { SlashCommandManager } from '../managers/SlashCommandManager';

import { StatusDataCollector } from '../services/StatusDataCollector';

import { PluginManager } from '../managers/PluginManager';
// 可选：导入内置插件
// import { LoggerPlugin } from '../plugins/builtin/LoggerPlugin';
// import { PerformancePlugin } from '../plugins/builtin/PerformancePlugin';
// import { SecurityPlugin } from '../plugins/builtin/SecurityPlugin';

import { AgentLoop } from '../agents/AgentLoop';
import { ExploreAgent } from '../agents/builtin/ExploreAgent';
import { GeneralAgent } from '../agents/builtin/GeneralAgent';
import { PlanAgent } from '../agents/builtin/PlanAgent';
import { ContextBuilderService } from '../context/ContextBuilderService';
import { RepoMapService } from '../context/RepoMapService';
import { AgentManager } from '../managers/AgentManager';
import { MemoryGovernanceService } from '../memory/MemoryGovernanceService';
import { MemoryRetrievalService } from '../memory/MemoryRetrievalService';
import { ProjectInstructionService } from '../memory/ProjectInstructionService';
import { ProjectMemoryService } from '../memory/ProjectMemoryService';
import { SessionMemoryService } from '../memory/SessionMemoryService';
import { UserPreferenceMemoryService } from '../memory/UserPreferenceMemoryService';
import { VerificationService } from '../verification/VerificationService';

import { AgentCommand } from '../commands/agent/AgentCommand';
import { CommitCommand } from '../commands/git/CommitCommand';
import { SkillCommand } from '../commands/skill/SkillCommand';
import { SkillManager } from '../managers/SkillManager';

import { HTTPServer } from '../server/HTTPServer';
import { WebSocketServer } from '../server/WebSocketServer';

import * as path from 'pathe';
import { MCPManager } from '../mcp/MCPManager';
import { EditCodeTool } from '../tools/code/EditCodeTool';
import { ApplyPatchTool } from '../tools/patch/ApplyPatchTool';
import { ProcessSandboxService } from '../tools/process/ProcessSandboxService';

// 🔥 新增：增强命令系统
import { CommandUIManager } from '../ui/managers/CommandUIManager';
import { KeyboardNavigationSystem } from '../ui/navigation/KeyboardNavigationSystem';
import { CommandStateManager } from '../ui/state/CommandStateManager';

/**
 * Application - 应用核心类
 *
 * 职责：
 * 1. 管理依赖注入容器
 * 2. 注册所有服务
 * 3. 管理应用生命周期
 *
 * 这是整个应用的"大脑"！
 */
export class Application {
  private container: Container;
  private configService?: ConfigService; // 新增
  private configManager?: ConfigManager; // 🔥 新增：配置管理器
  private pluginManager?: PluginManager; // 新增：插件管理器
  private agentManager?: AgentManager; // 新增
  private skillManager?: SkillManager; // 新增：技能管理器
  private mcpManager: MCPManager; // 🔥 新增：MCP 管理器
  private httpServer?: HTTPServer; // 🔥 新增：HTTP 服务器
  private wsServer?: WebSocketServer; // 🔥 新增：WebSocket 服务器

  // 🔥 新增：增强命令系统
  private commandUIManager?: CommandUIManager;
  private navigationSystem?: KeyboardNavigationSystem;
  private stateManager?: CommandStateManager;
  /**
   * 构造函数
   *
   * @param modelConfig 模型配置（可选，用于向后兼容）
   * @param configService 配置服务（可选，新的推荐方式）
   * @param configManager 配置管理器（可选，用于 Commit 命令）
   */
  constructor(
    modelConfig?: ModelConfig,
    configService?: ConfigService,
    configManager?: ConfigManager
  ) {
    this.container = new Container();
    this.configService = configService; // 新增
    this.configManager = configManager; // 🔥 新增
    this.mcpManager = new MCPManager(); // 🔥 新增：初始化 MCP 管理器

    // 注册服务
    this.registerServices(modelConfig);
    // 注册命令（新增）
    this.registerCommands();

    // 新增：初始化插件系统
    this.pluginManager = new PluginManager(this);
    this.container.register('plugin', this.pluginManager);

    // 新增：将插件管理器设置到 ToolManager
    const toolManager = this.container.get<ToolManager>('tool');
    toolManager.setPluginManager(this.pluginManager);

    // 🔥 新增：初始化 Agent 系统
    const sessionService = this.container.get<SessionService>('session');
    const eventBus = this.container.get<EventBus>('eventBus');

    this.agentManager = new AgentManager({
      toolManager,
      sessionService,
      eventBus,
    });

    // 🔥 新增：注册内置 Agent
    this.agentManager.register(new ExploreAgent());
    this.agentManager.register(new PlanAgent());
    this.agentManager.register(new GeneralAgent());

    // 🔥 新增：注册到容器
    this.container.register('agent', this.agentManager);

    console.log('✅ Application initialized');
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // 1. 创建命令管理器
    const commandManager = new SlashCommandManager();

    // 2. 注册会话管理命令
    commandManager.register(new EnhancedHelpCommand());
    commandManager.register(new ClearCommand());
    commandManager.register(new CompactCommand());
    commandManager.register(new ExitCommand());
    commandManager.register(new SessionsCommand());
    commandManager.register(new ForkCommand());
    commandManager.register(new ResumeCommand());

    // 3. 注册模型管理命令
    commandManager.register(new EnhancedModelCommand());

    // 4. 注册快照管理命令
    commandManager.register(new RewindCommand());
    commandManager.register(new SnapshotsCommand());

    // 5. 注册配置命令
    commandManager.register(new ConfigCommand());

    // 6. 注册MCP命令
    const eventBus = this.container.get<EventBus>('eventBus');
    commandManager.register(new MCPCommand(eventBus));

    // 7. 注册Status命令
    const statusCollector = this.container.get<StatusDataCollector>('statusCollector');
    commandManager.register(new StatusCommand(eventBus, statusCollector));

    // 8. 注册Spec命令
    commandManager.register(new SpecBrainstormCommand());
    commandManager.register(new SpecWritePlanCommand());
    commandManager.register(new SpecExecutePlanCommand());
    commandManager.register(new SpecCommand());

    // 9. 注册Review命令
    commandManager.register(new ReviewCommand());

    // 10. 注册命令管理器服务
    this.container.register('command', commandManager);
  }

  /**
   * 🔥 新增：初始化增强命令系统
   */
  private initializeEnhancedCommandSystem(): void {
    // 初始化命令UI管理器
    this.commandUIManager = new CommandUIManager();
    this.container.register('commandUI', this.commandUIManager);

    // 初始化键盘导航系统
    this.navigationSystem = new KeyboardNavigationSystem();
    this.container.register('navigation', this.navigationSystem);

    // 初始化状态管理器
    this.stateManager = new CommandStateManager();
    this.container.register('commandState', this.stateManager);

    // 设置事件监听
    this.setupCommandSystemEvents();

    console.log('✅ Enhanced command system initialized');
  }

  /**
   * 🔥 新增：设置命令系统事件监听
   */
  private setupCommandSystemEvents(): void {
    if (!this.commandUIManager || !this.navigationSystem || !this.stateManager) {
      return;
    }

    // 监听UI事件
    this.commandUIManager.on('sessionStarted', (session) => {
      console.log(`Command UI session started: ${session.command.name}`);
    });

    this.commandUIManager.on('sessionEnded', (data) => {
      console.log(`Command UI session ended: ${data.sessionId}`);
    });

    // 监听导航事件
    this.navigationSystem.on('move', (_data) => {
      // 处理导航移动
    });

    this.navigationSystem.on('select', (_data) => {
      // 处理选择事件
    });

    // 监听状态变化
    this.stateManager.on('stateUpdated', (_data) => {
      // 处理状态更新
    });
  }

  /**
   * 注册服务
   *
   * 这个方法会在构造函数中调用
   * 负责创建和注册所有服务
   */
  private registerServices(modelConfig?: ModelConfig): void {
    // 0. 创建 EventBus（最先创建）
    const eventBus = new EventBus();
    this.container.register('eventBus', eventBus);
    // 1. 创建 Paths
    const paths = new Paths({
      productName: 'aicli',
      cwd: process.cwd(),
    });
    this.container.register('paths', paths);
    const repoMapService = new RepoMapService(paths.getCwd());
    this.container.register('repoMap', repoMapService);
    const contextBuilderService = new ContextBuilderService(paths.getCwd());
    this.container.register('contextBuilder', contextBuilderService);
    const verificationService = new VerificationService(paths.getCwd());
    this.container.register('verification', verificationService);

    // 2. 创建 SessionService
    const sessionService = new SessionService(paths, eventBus);
    this.container.register('session', sessionService);
    const userPreferenceMemoryService = new UserPreferenceMemoryService(paths.getDataDir());
    this.container.register('userPreferenceMemory', userPreferenceMemoryService);
    const projectInstructionService = new ProjectInstructionService(paths.getCwd());
    this.container.register('projectInstruction', projectInstructionService);
    const projectMemoryService = new ProjectMemoryService(paths.getCwd());
    this.container.register('projectMemory', projectMemoryService);
    const memoryRetrievalService = new MemoryRetrievalService();
    this.container.register('memoryRetrieval', memoryRetrievalService);
    const memoryGovernanceService = new MemoryGovernanceService();
    this.container.register('memoryGovernance', memoryGovernanceService);
    const sessionMemoryService = new SessionMemoryService();
    this.container.register('sessionMemory', sessionMemoryService);
    const toolTraceService = new ToolTraceService();
    this.container.register('toolTrace', toolTraceService);

    // 3. 如果有 ConfigService，先注册它
    if (this.configService) {
      this.container.register('config', this.configService);
    }

    // 4. 创建 ToolManager
    const toolManager = new ToolManager();
    toolManager.setContainer(this.container);
    toolManager.setEventBus(eventBus);
    toolManager.setToolTraceService(toolTraceService);
    if (this.configService) {
      toolManager.setApprovalMode(this.configService.getConfig().approvalMode);
    }

    // 5. 注册工具
    // 文件操作工具（5个）
    toolManager.register(new ReadFileTool());
    toolManager.register(new WriteFileTool());
    toolManager.register(new ListFilesTool());
    toolManager.register(new EditFileTool());
    toolManager.register(new DeleteFileTool());

    toolManager.register(new EditCodeTool());
    toolManager.register(new ApplyPatchTool(paths.getCwd()));

    // 搜索工具（2个）
    toolManager.register(new GrepTool());
    toolManager.register(new GlobTool());

    // 系统工具（3个）
    const sandboxConfig = this.configService?.getConfig().sandbox ?? {
      mode: 'permissive',
      network: 'deny',
      allowUnsandboxedFallback: true,
    };
    const processSandboxService = new ProcessSandboxService(sandboxConfig);
    toolManager.register(new BashTool(processSandboxService, paths.getCwd()));
    toolManager.register(new ExecTool(processSandboxService, paths.getCwd()));
    toolManager.register(new EnvTool());

    // 网络工具（2个）
    toolManager.register(new FetchTool());
    toolManager.register(new WebSearchTool());

    // 任务工具（3个）
    toolManager.register(new TodoReadTool());
    toolManager.register(new TodoWriteTool());
    toolManager.register(new TaskTool());

    // 交互工具（2个）
    toolManager.register(new AskUserTool());
    toolManager.register(new ConfirmTool());

    // 特殊工具（2个）
    toolManager.register(new SkillTool());
    toolManager.register(new ExitPlanTool());

    // 6. 注册 ToolManager 服务
    this.container.register('tool', toolManager);

    // 7. 注册 MCPManager 服务
    this.container.register('mcpManager', this.mcpManager);

    // 8. 创建并注册 StatusDataCollector 服务
    const statusConfigService =
      this.configService ??
      new ConfigService({
        cwd: paths.getCwd(),
        productName: 'aicli',
      });
    const statusCollector = new StatusDataCollector(
      sessionService,
      statusConfigService,
      this.mcpManager
    );
    this.container.register('statusCollector', statusCollector);

    // 9. 创建并注册 ModelService
    // 优先使用 ConfigService 的配置，否则使用传入的 modelConfig
    const finalModelConfig = this.configService ? this.configService.getModelConfig() : modelConfig;

    if (finalModelConfig) {
      const modelService = new ModelService({
        ...finalModelConfig,
        container: this.container,
        paths: this.container.get<Paths>('paths'),
      });
      this.container.register('model', modelService);

      this.container.register(
        'agentLoop',
        new AgentLoop({
          modelService,
          toolManager,
          sessionService,
          eventBus,
          fileHistory: this.container.getFileHistory(),
          repoMapService,
          contextBuilderService,
          memoryGovernanceService,
          memoryRetrievalService,
          userPreferenceMemoryService,
          projectInstructionService,
          projectMemoryService,
          sessionMemoryService,
          verificationService,
        })
      );
    }

    // 10. 初始化 Spec 和 Plan 服务
    // 这些服务依赖于 paths, eventBus 和 model，所以放在最后初始化
    this.initializeSpecServices();
  }

  /**
   * 初始化 Spec 相关服务
   */
  private initializeSpecServices(): void {
    // 确保服务通过 Container 的懒加载方法初始化
    // 这样可以处理服务间的依赖关系
    this.container.getSpecManager();
    this.container.getPlanManager();
  }

  /**
   * 启动应用
   */
  async start(): Promise<void> {
    console.log('🚀 AICLI started');

    // 🔥 新增：初始化增强命令系统
    this.initializeEnhancedCommandSystem();

    // 初始化 SessionService
    const sessionService = this.container.get<SessionService>('session');
    await sessionService.initialize();

    // 根据项目配置加载内置插件。未知插件不会中断启动，会被记录到生命周期状态里。
    if (this.pluginManager && this.configService) {
      await this.pluginManager.loadFromConfig(this.configService.getConfig().plugins);
    }

    // 🔥 新增：初始化 SpecManager (使用 Container 的懒加载)
    const paths = this.container.get<Paths>('paths');
    const specManager = this.container.getSpecManager();
    await specManager.initialize();

    // 注意：Spec 相关命令已经在 registerCommands() 中注册，无需重复注册

    // 🔥 新增：初始化 SkillManager
    const commandManager = this.container.get<SlashCommandManager>('command');
    this.skillManager = new SkillManager(paths, commandManager);

    // 加载技能
    await this.skillManager.loadSkills();

    // 注册 skill 命令
    commandManager.register(new SkillCommand(this.skillManager));

    // 注册到容器
    this.container.register('skill', this.skillManager);

    // 🔥 新增：注册 Agent 命令
    if (this.agentManager) {
      commandManager.register(new AgentCommand(this.agentManager));
    }

    // 🔥 新增：注册 Commit 命令
    const modelService = this.container.get<ModelService>('model');
    if (modelService) {
      // 如果没有 configManager，从 paths 创建一个
      if (!this.configManager) {
        const { ConfigManager: ConfigManagerClass } = await import('../config/ConfigManager');
        this.configManager = new ConfigManagerClass({
          cwd: paths.getCwd(),
          productName: 'aicli',
        });
      }
      const configManager = this.configManager;
      commandManager.register(new CommitCommand(modelService, configManager));
    }

    // 🔥 新增：注册 Workspace 命令
    if (!this.configManager) {
      const { ConfigManager: ConfigManagerClass } = await import('../config/ConfigManager');
      this.configManager = new ConfigManagerClass({
        cwd: paths.getCwd(),
        productName: 'aicli',
      });
    }
    const { WorkspaceCommand } = await import('../commands/workspace/WorkspaceCommand');
    commandManager.register(new WorkspaceCommand(this.configManager));
    console.log('✅ Registered command: /workspace');

    // 🔥 新增：注册 Log 命令
    const { LogCommand } = await import('../commands/log/LogCommand');
    commandManager.register(new LogCommand(this.container));
    console.log('✅ Registered command: /log');

    const skills = this.skillManager.listSkills();
    if (skills.length > 0) {
      console.log(`✅ Loaded ${skills.length} skills`);
    }

    // 🔥 新增：初始化 MCP
    const mcpConfigPath = path.join(process.cwd(), 'mcp.json');
    await this.mcpManager.initialize(mcpConfigPath);

    // 🔥 新增：注册 MCP 工具
    const toolManager = this.container.get<ToolManager>('tool');
    const mcpTools = this.mcpManager.getTools();
    for (const tool of mcpTools) {
      toolManager.register(tool);
    }

    if (mcpTools.length > 0) {
      console.log(`✅ Registered ${mcpTools.length} MCP tools`);
    }

    // 输出已注册的服务
    const services = this.container.list();
    console.log(`📋 Registered services: ${services.join(', ')}`);

    // 输出已注册的工具
    const tools = toolManager.list();
    console.log(`🛠️  Registered tools: ${tools.join(', ')}`);
  }

  /**
   * 停止应用
   */
  async stop(): Promise<void> {
    console.log('👋 AICLI stopped');

    // 🔥 新增：断开 MCP 连接
    await this.mcpManager.disconnect();

    // 新增：卸载所有插件
    if (this.pluginManager) {
      await this.pluginManager.unloadAll();
    }
  }

  /**
   * 获取容器
   *
   * @returns 依赖注入容器
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * 获取配置服务
   *
   * @returns 配置服务（如果存在）
   */
  getConfigService(): ConfigService | undefined {
    return this.configService;
  }

  /**
   * 获取插件管理器
   *
   * @returns 插件管理器（如果存在）
   */
  getPluginManager(): PluginManager | undefined {
    return this.pluginManager;
  }
  /**
   * 获取 Agent 管理器
   *
   * @returns Agent 管理器（如果存在）
   */
  getAgentManager(): AgentManager | undefined {
    return this.agentManager;
  }

  /**
   * 获取 Skill 管理器
   *
   * @returns Skill 管理器（如果存在）
   */
  getSkillManager(): SkillManager | undefined {
    return this.skillManager;
  }

  /**
   * 设置输出样式
   *
   * @param styleName 样式名称
   */
  async setOutputStyle(styleName: string | undefined): Promise<void> {
    const modelService = this.container.get<ModelService>('model');
    modelService.setOutputStyle(styleName);

    const style = modelService.getOutputStyle();
    console.log(`Output style set to: ${style.name}`);
    console.log(`Description: ${style.description}`);
  }

  /**
   * 列出所有输出样式
   */
  async listOutputStyles(): Promise<void> {
    const modelService = this.container.get<ModelService>('model');
    const styles = modelService.listOutputStyles();

    console.log('Available output styles:');
    for (const style of styles) {
      const marker = style.isDefault() ? '(default)' : '';
      console.log(`  - ${style.name}: ${style.description} ${marker}`);
    }
  }

  /**
   * 启动服务器模式
   */
  async startServer(port = 3000): Promise<void> {
    console.log('🚀 Starting AICLI in server mode...\n');

    // 注册服务
    this.registerServices();

    // 创建 HTTP 服务器
    this.httpServer = new HTTPServer(this, port);
    await this.httpServer.start();

    // 创建 WebSocket 服务器
    const httpServerInstance = this.httpServer.getServer();
    if (httpServerInstance) {
      this.wsServer = new WebSocketServer(httpServerInstance, this);
    }

    console.log('\n✅ Server started successfully!');
    console.log(`📱 Open http://localhost:${port} in your browser\n`);
  }

  /**
   * 停止服务器
   */
  async stopServer(): Promise<void> {
    if (this.wsServer) {
      this.wsServer.close();
    }

    if (this.httpServer) {
      await this.httpServer.stop();
    }

    await this.stop();
  }
}
