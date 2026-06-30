import { nanoid } from 'nanoid';
import type { ModelService } from '../../services/ModelService.js';
import type { SpecDocument } from '../types.js';
import type {
  ImplementationPlan,
  PlanGenerationOptions,
  Phase,
  Task,
  TaskDependency,
  Risk,
  ResourceAllocation,
  TimeEstimate,
  TaskType,
  TaskPriority,
} from './types.js';

/**
 * 实施计划生成器
 *
 * 职责：
 * 1. 基于规格文档生成实施计划
 * 2. 任务分解和依赖分析
 * 3. 时间估算和资源分配
 * 4. 风险评估和缓解策略
 */
export class PlanGenerator {
  constructor(private modelService: ModelService) {}

  /**
   * 生成实施计划
   */
  async generatePlan(
    spec: SpecDocument,
    options: PlanGenerationOptions,
    projectPath: string
  ): Promise<ImplementationPlan> {
    try {
      // 1. 分析规格文档
      const specAnalysis = await this.analyzeSpec(spec);

      // 2. 生成阶段和任务
      const phases = await this.generatePhases(spec, specAnalysis, options);

      // 3. 分析任务依赖
      const dependencies = this.analyzeDependencies(phases);

      // 4. 评估风险
      const risks = await this.assessRisks(spec, phases, options);

      // 5. 分配资源
      const resources = this.allocateResources(phases, options);

      // 6. 计算总时间估算
      const totalEstimate = this.calculateTotalEstimate(phases);

      // 7. 计算关键路径
      const criticalPath = this.calculateCriticalPath(phases, dependencies);

      const plan: ImplementationPlan = {
        id: nanoid(),
        specId: spec.id,
        name: `${spec.title} - 实施计划`,
        description: `基于规格文档"${spec.title}"生成的详细实施计划`,
        phases,
        totalEstimate,
        dependencies,
        risks,
        resources,
        criticalPath,
        projectPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return plan;
    } catch (error) {
      console.error('生成实施计划失败:', error);
      return this.getFallbackPlan(spec, projectPath);
    }
  }

  /**
   * 分析规格文档
   */
  private async analyzeSpec(spec: SpecDocument): Promise<{
    complexity: 'low' | 'medium' | 'high';
    features: string[];
    technologies: string[];
    constraints: string[];
  }> {
    const prompt = this.buildSpecAnalysisPrompt(spec);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseSpecAnalysis(responseText);
    } catch (error) {
      console.error('规格分析失败:', error);
      return {
        complexity: 'medium',
        features: ['基础功能实现'],
        technologies: ['JavaScript', 'Node.js'],
        constraints: ['时间约束', '资源约束'],
      };
    }
  }

  /**
   * 生成实施阶段
   */
  private async generatePhases(
    spec: SpecDocument,
    analysis: any,
    options: PlanGenerationOptions
  ): Promise<Phase[]> {
    const prompt = this.buildPhaseGenerationPrompt(spec, analysis, options);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parsePhases(responseText);
    } catch (error) {
      console.error('阶段生成失败:', error);
      return this.getFallbackPhases(spec);
    }
  }

  /**
   * 分析任务依赖关系
   */
  private analyzeDependencies(phases: Phase[]): TaskDependency[] {
    const dependencies: TaskDependency[] = [];
    const allTasks = phases.flatMap((phase) => phase.tasks);

    for (const task of allTasks) {
      for (const depId of task.dependencies) {
        const depTask = allTasks.find((t) => t.id === depId);
        if (depTask) {
          dependencies.push({
            fromTaskId: depId,
            toTaskId: task.id,
            type: 'finish_to_start',
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * 评估项目风险
   */
  private async assessRisks(
    spec: SpecDocument,
    phases: Phase[],
    options: PlanGenerationOptions
  ): Promise<Risk[]> {
    if (!options.includeRiskAssessment) {
      return [];
    }

    const prompt = this.buildRiskAssessmentPrompt(spec, phases, options);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseRisks(responseText);
    } catch (error) {
      console.error('风险评估失败:', error);
      return this.getFallbackRisks();
    }
  }

  /**
   * 分配项目资源
   */
  private allocateResources(phases: Phase[], options: PlanGenerationOptions): ResourceAllocation[] {
    if (!options.includeResourceAllocation) {
      return [];
    }

    const resources: ResourceAllocation[] = [];
    const allTasks = phases.flatMap((phase) => phase.tasks);

    // 根据任务类型分配资源
    const tasksByType = this.groupTasksByType(allTasks);

    if (tasksByType.development.length > 0) {
      resources.push({
        type: 'developer',
        count: this.getResourceCount(options.teamSize, 'developer'),
        skills: ['JavaScript', 'TypeScript', 'Node.js'],
        allocation: this.calculateResourceAllocation(tasksByType.development),
      });
    }

    if (tasksByType.testing.length > 0) {
      resources.push({
        type: 'tester',
        count: this.getResourceCount(options.teamSize, 'tester'),
        skills: ['测试设计', '自动化测试', 'Bug跟踪'],
        allocation: this.calculateResourceAllocation(tasksByType.testing),
      });
    }

    if (tasksByType.deployment.length > 0) {
      resources.push({
        type: 'devops',
        count: this.getResourceCount(options.teamSize, 'devops'),
        skills: ['Docker', 'CI/CD', '云服务'],
        allocation: this.calculateResourceAllocation(tasksByType.deployment),
      });
    }

    return resources;
  }

  /**
   * 计算总时间估算
   */
  private calculateTotalEstimate(phases: Phase[]): TimeEstimate {
    let totalMin = 0;
    let totalMax = 0;
    let totalExpected = 0;

    for (const phase of phases) {
      totalMin += phase.estimate.min;
      totalMax += phase.estimate.max;
      totalExpected += phase.estimate.expected;
    }

    return {
      min: totalMin,
      max: totalMax,
      expected: totalExpected,
      unit: 'days',
    };
  }

  /**
   * 计算关键路径
   */
  private calculateCriticalPath(phases: Phase[], dependencies: TaskDependency[]): string[] {
    // 简化的关键路径计算
    const allTasks = phases.flatMap((phase) => phase.tasks);
    const criticalTasks = allTasks
      .filter((task) => task.priority === 'critical' || task.priority === 'high')
      .sort((a, b) => b.estimate.expected - a.estimate.expected)
      .slice(0, 5);

    return criticalTasks.map((task) => task.id);
  }

  // ===== 私有辅助方法 =====

  /**
   * 构建规格分析提示词
   */
  private buildSpecAnalysisPrompt(spec: SpecDocument): string {
    return `请分析以下规格文档，评估项目复杂度、识别关键功能和技术栈：

规格文档：
标题：${spec.title}
描述：${spec.description}
内容：${spec.content.substring(0, 2000)}...

请以JSON格式返回分析结果：
{
  "complexity": "low|medium|high",
  "features": ["功能1", "功能2"],
  "technologies": ["技术1", "技术2"],
  "constraints": ["约束1", "约束2"]
}`;
  }

  /**
   * 构建阶段生成提示词
   */
  private buildPhaseGenerationPrompt(
    spec: SpecDocument,
    analysis: any,
    options: PlanGenerationOptions
  ): string {
    return `基于规格文档和分析结果，生成详细的实施计划阶段和任务：

规格文档：${spec.title}
项目复杂度：${analysis.complexity}
主要功能：${analysis.features.join(', ')}
技术栈：${analysis.technologies.join(', ')}

生成选项：
- 详细程度：${options.detailLevel}
- 团队规模：${options.teamSize}
- 项目复杂度：${options.complexity}

请生成4-6个实施阶段，每个阶段包含3-8个具体任务。
返回JSON格式的阶段数组，包含任务的详细信息、时间估算、依赖关系等。

格式示例：
[
  {
    "id": "phase-1",
    "name": "项目初始化",
    "description": "搭建项目基础架构",
    "tasks": [...],
    "estimate": {"min": 3, "max": 5, "expected": 4, "unit": "days"},
    "prerequisites": [],
    "objectives": ["目标1"],
    "deliverables": ["交付物1"],
    "milestones": ["里程碑1"]
  }
]`;
  }

  /**
   * 构建风险评估提示词
   */
  private buildRiskAssessmentPrompt(
    spec: SpecDocument,
    phases: Phase[],
    options: PlanGenerationOptions
  ): string {
    return `基于项目规格和实施计划，评估项目风险：

项目：${spec.title}
复杂度：${options.complexity}
团队规模：${options.teamSize}
阶段数量：${phases.length}

请识别5-10个主要风险，包括技术风险、业务风险、资源风险等。
返回JSON格式的风险数组。

格式示例：
[
  {
    "id": "risk-1",
    "name": "技术选型风险",
    "description": "新技术学习成本高",
    "category": "technical",
    "impact": "medium",
    "probability": "medium",
    "level": "medium",
    "mitigation": ["提前技术调研", "团队培训"],
    "contingency": ["备选技术方案"]
  }
]`;
  }

  /**
   * 解析规格分析结果
   */
  private parseSpecAnalysis(response: string): any {
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      return {
        complexity: 'medium',
        features: ['基础功能'],
        technologies: ['JavaScript'],
        constraints: ['时间约束'],
      };
    }
  }

  /**
   * 解析阶段信息
   */
  private parsePhases(response: string): Phase[] {
    try {
      const cleaned = this.cleanJsonResponse(response);
      const phases = JSON.parse(cleaned);
      return Array.isArray(phases) ? phases : this.getFallbackPhases();
    } catch (error) {
      return this.getFallbackPhases();
    }
  }

  /**
   * 解析风险信息
   */
  private parseRisks(response: string): Risk[] {
    try {
      const cleaned = this.cleanJsonResponse(response);
      const risks = JSON.parse(cleaned);
      return Array.isArray(risks) ? risks : this.getFallbackRisks();
    } catch (error) {
      return this.getFallbackRisks();
    }
  }

  /**
   * 清理JSON响应
   */
  private cleanJsonResponse(response: string): string {
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    const start = cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : cleaned.indexOf('[');
    const end =
      cleaned.lastIndexOf('}') !== -1 ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }

    return cleaned.trim();
  }

  /**
   * 按类型分组任务
   */
  private groupTasksByType(tasks: Task[]): Record<TaskType, Task[]> {
    const groups: Record<TaskType, Task[]> = {
      setup: [],
      development: [],
      testing: [],
      deployment: [],
      documentation: [],
      review: [],
    };

    for (const task of tasks) {
      groups[task.type].push(task);
    }

    return groups;
  }

  /**
   * 获取资源数量
   */
  private getResourceCount(teamSize: string, resourceType: string): number {
    const counts = {
      small: { developer: 2, tester: 1, devops: 1 },
      medium: { developer: 4, tester: 2, devops: 1 },
      large: { developer: 8, tester: 3, devops: 2 },
    };

    return (
      counts[teamSize as keyof typeof counts]?.[resourceType as keyof typeof counts.small] || 1
    );
  }

  /**
   * 计算资源分配时间
   */
  private calculateResourceAllocation(tasks: Task[]): TimeEstimate {
    let totalMin = 0;
    let totalMax = 0;
    let totalExpected = 0;

    for (const task of tasks) {
      totalMin += task.estimate.min;
      totalMax += task.estimate.max;
      totalExpected += task.estimate.expected;
    }

    return {
      min: totalMin,
      max: totalMax,
      expected: totalExpected,
      unit: 'days',
    };
  }

  /**
   * 获取备用计划
   */
  private getFallbackPlan(spec: SpecDocument, projectPath: string): ImplementationPlan {
    const phases = this.getFallbackPhases(spec);

    return {
      id: nanoid(),
      specId: spec.id,
      name: `${spec.title} - 实施计划`,
      description: `基于规格文档"${spec.title}"生成的基础实施计划`,
      phases,
      totalEstimate: { min: 15, max: 25, expected: 20, unit: 'days' },
      dependencies: [],
      risks: this.getFallbackRisks(),
      resources: [],
      criticalPath: [],
      projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * 获取备用阶段
   */
  private getFallbackPhases(spec?: SpecDocument): Phase[] {
    return [
      {
        id: 'phase-1',
        name: '项目初始化',
        description: '搭建项目基础架构和开发环境',
        tasks: [
          {
            id: 'task-1-1',
            name: '项目结构搭建',
            description: '创建项目目录结构和基础配置',
            type: 'setup',
            priority: 'high',
            status: 'pending',
            estimate: { min: 1, max: 2, expected: 1.5, unit: 'days' },
            dependencies: [],
            prerequisites: [],
            acceptanceCriteria: ['项目结构完整', '配置文件正确'],
            technicalRequirements: ['Node.js', 'TypeScript'],
            risks: ['环境配置问题'],
            tags: ['setup', 'infrastructure'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'task-1-2',
            name: '开发环境配置',
            description: '配置开发工具和CI/CD流程',
            type: 'setup',
            priority: 'medium',
            status: 'pending',
            estimate: { min: 1, max: 3, expected: 2, unit: 'days' },
            dependencies: ['task-1-1'],
            prerequisites: ['项目结构已搭建'],
            acceptanceCriteria: ['开发环境可用', 'CI/CD流程正常'],
            technicalRequirements: ['Git', 'Docker'],
            risks: ['工具兼容性问题'],
            tags: ['setup', 'devops'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        estimate: { min: 2, max: 5, expected: 3.5, unit: 'days' },
        prerequisites: [],
        objectives: ['建立开发基础'],
        deliverables: ['项目骨架', '开发环境'],
        milestones: ['开发环境就绪'],
      },
      {
        id: 'phase-2',
        name: '核心功能开发',
        description: '实现项目的核心业务功能',
        tasks: [
          {
            id: 'task-2-1',
            name: '核心模块开发',
            description: '实现主要业务逻辑',
            type: 'development',
            priority: 'critical',
            status: 'pending',
            estimate: { min: 5, max: 8, expected: 6.5, unit: 'days' },
            dependencies: ['task-1-2'],
            prerequisites: ['开发环境已配置'],
            acceptanceCriteria: ['功能完整', '代码质量达标'],
            technicalRequirements: ['业务逻辑实现'],
            risks: ['需求理解偏差'],
            tags: ['development', 'core'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        estimate: { min: 5, max: 8, expected: 6.5, unit: 'days' },
        prerequisites: ['项目初始化完成'],
        objectives: ['实现核心功能'],
        deliverables: ['核心模块'],
        milestones: ['核心功能完成'],
      },
      {
        id: 'phase-3',
        name: '测试和部署',
        description: '测试验证和生产部署',
        tasks: [
          {
            id: 'task-3-1',
            name: '功能测试',
            description: '执行全面的功能测试',
            type: 'testing',
            priority: 'high',
            status: 'pending',
            estimate: { min: 3, max: 5, expected: 4, unit: 'days' },
            dependencies: ['task-2-1'],
            prerequisites: ['核心功能已完成'],
            acceptanceCriteria: ['测试通过率>95%'],
            technicalRequirements: ['测试框架'],
            risks: ['测试覆盖不足'],
            tags: ['testing', 'quality'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'task-3-2',
            name: '生产部署',
            description: '部署到生产环境',
            type: 'deployment',
            priority: 'high',
            status: 'pending',
            estimate: { min: 2, max: 4, expected: 3, unit: 'days' },
            dependencies: ['task-3-1'],
            prerequisites: ['测试通过'],
            acceptanceCriteria: ['部署成功', '服务正常'],
            technicalRequirements: ['部署脚本', '监控系统'],
            risks: ['部署失败'],
            tags: ['deployment', 'production'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        estimate: { min: 5, max: 9, expected: 7, unit: 'days' },
        prerequisites: ['核心功能开发完成'],
        objectives: ['确保质量', '成功上线'],
        deliverables: ['测试报告', '生产系统'],
        milestones: ['项目上线'],
      },
    ];
  }

  /**
   * 获取备用风险
   */
  private getFallbackRisks(): Risk[] {
    return [
      {
        id: 'risk-1',
        name: '技术风险',
        description: '新技术学习成本和兼容性问题',
        category: 'technical',
        impact: 'medium',
        probability: 'medium',
        level: 'medium',
        mitigation: ['技术调研', '原型验证'],
        contingency: ['备选技术方案'],
      },
      {
        id: 'risk-2',
        name: '时间风险',
        description: '开发时间可能超出预期',
        category: 'timeline',
        impact: 'high',
        probability: 'medium',
        level: 'medium',
        mitigation: ['合理估算', '进度跟踪'],
        contingency: ['功能裁剪', '资源增加'],
      },
      {
        id: 'risk-3',
        name: '需求变更风险',
        description: '需求可能发生变化',
        category: 'business',
        impact: 'medium',
        probability: 'high',
        level: 'medium',
        mitigation: ['需求确认', '变更控制'],
        contingency: ['敏捷开发', '迭代交付'],
      },
    ];
  }
}
