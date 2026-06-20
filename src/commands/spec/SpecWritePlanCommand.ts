import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import type { SpecManager } from '../../spec/SpecManager.js';
import type { PlanManager } from '../../spec/plan/PlanManager.js';
import type { EventBus } from '../../services/EventBus.js';
import type {
  PlanGenerationOptions,
  ImplementationPlan,
  CreatePlanRequest,
} from '../../spec/plan/types.js';

/**
 * SpecWritePlanCommand - Spec 实施计划编写命令
 *
 * 用法：
 * /spec:write-plan <spec-id>
 * /spec:write-plan <spec-id> --detailed
 * /spec:write-plan <spec-id> --team-size large --complexity high
 */
export class SpecWritePlanCommand extends SlashCommand {
  name = 'spec:write-plan';
  description = 'Generate detailed implementation plan from specification';
  aliases = ['spec:plan', 'write-plan'];

  validate(args: string[]): boolean {
    if (args.length === 0) {
      console.log('❌ 用法: /spec:write-plan <spec-id> [选项]');
      console.log('   示例: /spec:write-plan spec_abc123');
      console.log('   选项:');
      console.log('     --detailed              生成详细计划');
      console.log('     --team-size <size>      团队规模 (small|medium|large)');
      console.log('     --complexity <level>    项目复杂度 (low|medium|high)');
      console.log('     --no-risks             不包含风险评估');
      console.log('     --no-resources         不包含资源分配');
      return false;
    }
    return true;
  }

  async execute(args: string[], app: Application): Promise<void> {
    try {
      // 获取服务
      const specManager = app.getContainer().get<SpecManager>('spec');
      const planManager = app.getContainer().get<PlanManager>('plan');
      const eventBus = app.getContainer().get<EventBus>('eventBus');

      // 解析参数
      const { specId, options } = this.parseArguments(args);

      // 验证规格文档存在
      const spec = await specManager.get(specId);
      if (!spec) {
        console.log(`❌ 规格文档不存在: ${specId}`);
        console.log('💡 使用 /spec:list 查看所有规格文档');
        return;
      }

      // 设置事件监听器
      this.setupEventListeners(eventBus);

      // 显示开始信息
      console.log(`📋 开始为规格文档生成实施计划...`);
      console.log(`📄 规格文档: ${spec.title} (${spec.id})`);
      console.log(`⚙️  生成选项: ${this.formatOptions(options)}\n`);

      // 创建实施计划
      const planRequest: CreatePlanRequest = {
        specId,
        options,
        projectPath: process.cwd(),
      };

      const plan = await planManager.create(planRequest);

      // 显示结果
      await this.displayPlanSummary(plan);

      // 询问是否导出
      await this.promptForExport(plan, planManager);
    } catch (error) {
      console.error('❌ 生成实施计划失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 解析命令参数
   */
  private parseArguments(args: string[]): {
    specId: string;
    options: PlanGenerationOptions;
  } {
    const specId = args[0];
    const options: PlanGenerationOptions = {
      detailLevel: 'detailed',
      includeRiskAssessment: true,
      includeResourceAllocation: true,
      includeTimeEstimation: true,
      teamSize: 'medium',
      complexity: 'medium',
    };

    // 解析选项
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--detailed':
          options.detailLevel = 'comprehensive';
          break;
        case '--basic':
          options.detailLevel = 'basic';
          break;
        case '--team-size':
          if (i + 1 < args.length) {
            const size = args[i + 1];
            if (['small', 'medium', 'large'].includes(size)) {
              options.teamSize = size as 'small' | 'medium' | 'large';
              i++; // 跳过下一个参数
            }
          }
          break;
        case '--complexity':
          if (i + 1 < args.length) {
            const complexity = args[i + 1];
            if (['low', 'medium', 'high'].includes(complexity)) {
              options.complexity = complexity as 'low' | 'medium' | 'high';
              i++; // 跳过下一个参数
            }
          }
          break;
        case '--no-risks':
          options.includeRiskAssessment = false;
          break;
        case '--no-resources':
          options.includeResourceAllocation = false;
          break;
        case '--no-time':
          options.includeTimeEstimation = false;
          break;
      }
    }

    return { specId, options };
  }

  /**
   * 格式化选项显示
   */
  private formatOptions(options: PlanGenerationOptions): string {
    const parts: string[] = [];

    parts.push(`详细程度=${options.detailLevel}`);
    parts.push(`团队规模=${options.teamSize}`);
    parts.push(`复杂度=${options.complexity}`);

    if (options.includeRiskAssessment) parts.push('包含风险评估');
    if (options.includeResourceAllocation) parts.push('包含资源分配');
    if (options.includeTimeEstimation) parts.push('包含时间估算');

    return parts.join(', ');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(eventBus: EventBus): void {
    eventBus.on('plan_event', (event) => {
      switch (event.type) {
        case 'plan_generation_started':
          console.log('🔄 正在分析规格文档...');
          break;
        case 'plan_created':
          console.log(`✅ 实施计划生成完成`);
          console.log(`📊 包含 ${event.data.phasesCount} 个阶段，${event.data.tasksCount} 个任务`);
          break;
        case 'plan_creation_failed':
          console.log(`❌ 计划生成失败: ${event.data.error}`);
          break;
      }
    });
  }

  /**
   * 显示计划摘要
   */
  private async displayPlanSummary(plan: ImplementationPlan): Promise<void> {
    console.log(`\n📋 实施计划摘要`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 计划名称: ${plan.name}`);
    console.log(`🆔 计划ID: ${plan.id}`);
    console.log(`📝 描述: ${plan.description}`);
    console.log(
      `⏱️  总时间估算: ${plan.totalEstimate.min}-${plan.totalEstimate.max} ${plan.totalEstimate.unit} (预期: ${plan.totalEstimate.expected})`
    );
    console.log(`📊 阶段数量: ${plan.phases.length}`);
    console.log(`📋 任务总数: ${this.getTotalTasksCount(plan)}`);

    // 显示阶段概览
    console.log(`\n📋 阶段概览:`);
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      console.log(
        `  ${i + 1}. ${phase.name} (${phase.tasks.length} 个任务, ${phase.estimate.expected} ${phase.estimate.unit})`
      );
    }

    // 显示风险概览
    if (plan.risks.length > 0) {
      console.log(`\n⚠️  风险概览:`);
      const risksByLevel = this.groupRisksByLevel(plan.risks);
      for (const [level, risks] of Object.entries(risksByLevel)) {
        if (risks.length > 0) {
          console.log(`  ${this.getRiskIcon(level)} ${level}: ${risks.length} 个风险`);
        }
      }
    }

    // 显示资源概览
    if (plan.resources.length > 0) {
      console.log(`\n👥 资源需求:`);
      for (const resource of plan.resources) {
        console.log(
          `  ${this.getResourceIcon(resource.type)} ${resource.type}: ${resource.count} 人 (${resource.allocation.expected} ${resource.allocation.unit})`
        );
      }
    }

    console.log(`\n💾 计划已保存到: ~/.aicli/data/plans/${plan.id}.json`);
  }

  /**
   * 询问是否导出计划
   */
  private async promptForExport(plan: ImplementationPlan, planManager: PlanManager): Promise<void> {
    console.log(`\n📤 导出选项:`);
    console.log(`1. 导出为 Markdown 文档`);
    console.log(`2. 查看详细计划内容`);
    console.log(`3. 跳过导出`);

    // 简化实现：自动选择导出为Markdown
    console.log(`\n> 选择 1 (导出为 Markdown)`);

    try {
      const markdown = await planManager.exportToMarkdown(plan.id);
      if (markdown) {
        const filename = `${plan.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_plan.md`;
        console.log(`\n📄 Markdown 内容已生成`);
        console.log(`💡 提示: 可以将内容保存为 ${filename}`);
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(markdown.substring(0, 500) + '...');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }
    } catch (error) {
      console.log(`❌ 导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(`\n💡 后续操作:`);
    console.log(`   /spec:execute-plan ${plan.id}  # 开始执行计划`);
    console.log(`   /spec:list-plans               # 查看所有计划`);
    console.log(`   /spec:show-plan ${plan.id}     # 查看计划详情`);
  }

  /**
   * 获取总任务数
   */
  private getTotalTasksCount(plan: ImplementationPlan): number {
    return plan.phases.reduce((total, phase) => total + phase.tasks.length, 0);
  }

  /**
   * 按风险等级分组
   */
  private groupRisksByLevel(risks: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const risk of risks) {
      if (groups[risk.level]) {
        groups[risk.level].push(risk);
      }
    }

    return groups;
  }

  /**
   * 获取风险图标
   */
  private getRiskIcon(level: string): string {
    const icons: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return icons[level] || '⚪';
  }

  /**
   * 获取资源图标
   */
  private getResourceIcon(type: string): string {
    const icons: Record<string, string> = {
      developer: '👨‍💻',
      designer: '🎨',
      tester: '🧪',
      devops: '⚙️',
      manager: '👔',
    };
    return icons[type] || '👤';
  }
}
