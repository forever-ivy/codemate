import { join } from 'pathe';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import type { Paths } from '../../services/Paths.js';
import type { ImplementationPlan, CreatePlanRequest, UpdatePlanRequest } from './types.js';

/**
 * 实施计划存储管理器
 *
 * 职责：
 * 1. 计划文件的读写操作
 * 2. 计划数据的序列化和反序列化
 * 3. 计划文件的组织和管理
 */
export class PlanStorage {
  private readonly plansDir: string;

  constructor(private paths: Paths) {
    this.plansDir = join(this.paths.getDataDir(), 'plans');
  }

  /**
   * 初始化存储目录
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.plansDir, { recursive: true });
    } catch (error) {
      console.error('初始化计划存储目录失败:', error);
      throw error;
    }
  }

  /**
   * 保存实施计划
   */
  async save(plan: ImplementationPlan): Promise<void> {
    try {
      await this.initialize();

      const planPath = this.getPlanPath(plan.id);
      const planData = JSON.stringify(plan, null, 2);

      await writeFile(planPath, planData, 'utf-8');
    } catch (error) {
      console.error(`保存计划失败 (${plan.id}):`, error);
      throw new Error(`保存计划失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 读取实施计划
   */
  async load(planId: string): Promise<ImplementationPlan | null> {
    try {
      const planPath = this.getPlanPath(planId);
      const planData = await readFile(planPath, 'utf-8');

      const plan = JSON.parse(planData) as ImplementationPlan;

      // 转换日期字符串为Date对象
      plan.createdAt = new Date(plan.createdAt);
      plan.updatedAt = new Date(plan.updatedAt);

      // 转换任务日期
      for (const phase of plan.phases) {
        for (const task of phase.tasks) {
          task.createdAt = new Date(task.createdAt);
          task.updatedAt = new Date(task.updatedAt);
        }
      }

      return plan;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null;
      }
      console.error(`读取计划失败 (${planId}):`, error);
      throw new Error(`读取计划失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除实施计划
   */
  async delete(planId: string): Promise<boolean> {
    try {
      const planPath = this.getPlanPath(planId);
      await readFile(planPath); // 检查文件是否存在

      const { unlink } = await import('node:fs/promises');
      await unlink(planPath);

      return true;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return false;
      }
      console.error(`删除计划失败 (${planId}):`, error);
      throw new Error(`删除计划失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 列出所有实施计划
   */
  async list(): Promise<ImplementationPlan[]> {
    try {
      await this.initialize();

      const files = await readdir(this.plansDir);
      const planFiles = files.filter((file) => file.endsWith('.json'));

      const plans: ImplementationPlan[] = [];

      for (const file of planFiles) {
        try {
          const planId = file.replace('.json', '');
          const plan = await this.load(planId);
          if (plan) {
            plans.push(plan);
          }
        } catch (error) {
          console.warn(`跳过无效的计划文件: ${file}`, error);
        }
      }

      // 按创建时间倒序排列
      return plans.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('列出计划失败:', error);
      return [];
    }
  }

  /**
   * 根据规格ID查找计划
   */
  async findBySpecId(specId: string): Promise<ImplementationPlan[]> {
    try {
      const allPlans = await this.list();
      return allPlans.filter((plan) => plan.specId === specId);
    } catch (error) {
      console.error(`根据规格ID查找计划失败 (${specId}):`, error);
      return [];
    }
  }

  /**
   * 更新实施计划
   */
  async update(
    planId: string,
    updates: Partial<ImplementationPlan>
  ): Promise<ImplementationPlan | null> {
    try {
      const existingPlan = await this.load(planId);
      if (!existingPlan) {
        return null;
      }

      const updatedPlan: ImplementationPlan = {
        ...existingPlan,
        ...updates,
        id: planId, // 确保ID不被覆盖
        updatedAt: new Date(),
      };

      await this.save(updatedPlan);
      return updatedPlan;
    } catch (error) {
      console.error(`更新计划失败 (${planId}):`, error);
      throw new Error(`更新计划失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查计划是否存在
   */
  async exists(planId: string): Promise<boolean> {
    try {
      const planPath = this.getPlanPath(planId);
      await stat(planPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取计划统计信息
   */
  async getStats(): Promise<{
    totalPlans: number;
    plansBySpec: Record<string, number>;
    recentPlans: ImplementationPlan[];
  }> {
    try {
      const allPlans = await this.list();

      const plansBySpec: Record<string, number> = {};
      for (const plan of allPlans) {
        plansBySpec[plan.specId] = (plansBySpec[plan.specId] || 0) + 1;
      }

      const recentPlans = allPlans.slice(0, 5);

      return {
        totalPlans: allPlans.length,
        plansBySpec,
        recentPlans,
      };
    } catch (error) {
      console.error('获取计划统计信息失败:', error);
      return {
        totalPlans: 0,
        plansBySpec: {},
        recentPlans: [],
      };
    }
  }

  /**
   * 导出计划为Markdown格式
   */
  async exportToMarkdown(planId: string): Promise<string | null> {
    try {
      const plan = await this.load(planId);
      if (!plan) {
        return null;
      }

      return this.generateMarkdown(plan);
    } catch (error) {
      console.error(`导出计划失败 (${planId}):`, error);
      return null;
    }
  }

  /**
   * 批量导入计划
   */
  async importPlans(plans: ImplementationPlan[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const plan of plans) {
      try {
        await this.save(plan);
        success++;
      } catch (error) {
        failed++;
        errors.push(`计划 ${plan.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { success, failed, errors };
  }

  // ===== 私有方法 =====

  /**
   * 获取计划文件路径
   */
  private getPlanPath(planId: string): string {
    return join(this.plansDir, `${planId}.json`);
  }

  /**
   * 生成Markdown格式的计划文档
   */
  private generateMarkdown(plan: ImplementationPlan): string {
    const sections: string[] = [];

    // 标题和基本信息
    sections.push(`# ${plan.name}`);
    sections.push(`\n**描述**: ${plan.description}`);
    sections.push(`**规格文档ID**: ${plan.specId}`);
    sections.push(`**项目路径**: ${plan.projectPath}`);
    sections.push(`**创建时间**: ${plan.createdAt.toLocaleString()}`);
    sections.push(`**更新时间**: ${plan.updatedAt.toLocaleString()}`);

    // 总体估算
    sections.push(`\n## 总体时间估算`);
    sections.push(`- **最小时间**: ${plan.totalEstimate.min} ${plan.totalEstimate.unit}`);
    sections.push(`- **预期时间**: ${plan.totalEstimate.expected} ${plan.totalEstimate.unit}`);
    sections.push(`- **最大时间**: ${plan.totalEstimate.max} ${plan.totalEstimate.unit}`);

    // 实施阶段
    sections.push(`\n## 实施阶段`);
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      sections.push(`\n### 阶段 ${i + 1}: ${phase.name}`);
      sections.push(`\n**描述**: ${phase.description}`);

      if (phase.objectives.length > 0) {
        sections.push(`\n**目标**:`);
        phase.objectives.forEach((obj) => sections.push(`- ${obj}`));
      }

      if (phase.deliverables.length > 0) {
        sections.push(`\n**交付物**:`);
        phase.deliverables.forEach((del) => sections.push(`- ${del}`));
      }

      sections.push(
        `\n**时间估算**: ${phase.estimate.min}-${phase.estimate.max} ${phase.estimate.unit} (预期: ${phase.estimate.expected})`
      );

      // 阶段任务
      sections.push(`\n#### 任务列表`);
      for (let j = 0; j < phase.tasks.length; j++) {
        const task = phase.tasks[j];
        sections.push(`\n**${j + 1}. ${task.name}** (${task.type}, ${task.priority})`);
        sections.push(`- **描述**: ${task.description}`);
        sections.push(`- **时间估算**: ${task.estimate.expected} ${task.estimate.unit}`);

        if (task.acceptanceCriteria.length > 0) {
          sections.push(`- **验收标准**: ${task.acceptanceCriteria.join(', ')}`);
        }

        if (task.dependencies.length > 0) {
          sections.push(`- **依赖任务**: ${task.dependencies.join(', ')}`);
        }
      }
    }

    // 风险评估
    if (plan.risks.length > 0) {
      sections.push(`\n## 风险评估`);
      for (const risk of plan.risks) {
        sections.push(`\n### ${risk.name} (${risk.level})`);
        sections.push(`- **类别**: ${risk.category}`);
        sections.push(`- **影响**: ${risk.impact}`);
        sections.push(`- **概率**: ${risk.probability}`);
        sections.push(`- **描述**: ${risk.description}`);

        if (risk.mitigation.length > 0) {
          sections.push(`- **缓解措施**: ${risk.mitigation.join(', ')}`);
        }
      }
    }

    // 资源分配
    if (plan.resources.length > 0) {
      sections.push(`\n## 资源分配`);
      for (const resource of plan.resources) {
        sections.push(`\n### ${resource.type} (${resource.count}人)`);
        sections.push(`- **技能要求**: ${resource.skills.join(', ')}`);
        sections.push(
          `- **分配时间**: ${resource.allocation.expected} ${resource.allocation.unit}`
        );
      }
    }

    // 关键路径
    if (plan.criticalPath.length > 0) {
      sections.push(`\n## 关键路径`);
      sections.push(`关键任务: ${plan.criticalPath.join(' → ')}`);
    }

    return sections.join('\n');
  }
}
