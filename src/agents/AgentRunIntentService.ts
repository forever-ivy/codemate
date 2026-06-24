export type AgentRunIntent = 'answer-only' | 'inspect-only' | 'code-change';

export interface AgentRunIntentDecision {
  intent: AgentRunIntent;
  requiresFileChange: boolean;
  requiresVerification: boolean;
  reason: string;
}

/**
 * Classifies the user's request into the run contract AgentLoop should enforce.
 *
 * This first version is deliberately deterministic. It detects broad delivery
 * intent rather than special-casing individual tasks like menus or tables, so
 * later chapters can replace the internals with a model classifier without
 * changing the AgentLoop contract.
 */
export class AgentRunIntentService {
  classify(message: string): AgentRunIntentDecision {
    const normalized = this.normalize(message);

    if (this.hasCodeChangeIntent(normalized)) {
      return {
        intent: 'code-change',
        requiresFileChange: true,
        requiresVerification: true,
        reason: 'The request asks the agent to create, modify, fix, or implement workspace work.',
      };
    }

    if (this.hasInspectionIntent(normalized)) {
      return {
        intent: 'inspect-only',
        requiresFileChange: false,
        requiresVerification: false,
        reason: 'The request asks the agent to inspect or explain repository code.',
      };
    }

    return {
      intent: 'answer-only',
      requiresFileChange: false,
      requiresVerification: false,
      reason: 'The request can be answered without inspecting or changing workspace files.',
    };
  }

  private hasCodeChangeIntent(message: string): boolean {
    return this.includesAny(message, [
      'add',
      'build',
      'change',
      'configure',
      'create',
      'edit',
      'fix',
      'implement',
      'modify',
      'refactor',
      'remove',
      'rename',
      'update',
      'write',
      '新增',
      '添加',
      '加',
      '创建',
      '修改',
      '修复',
      '实现',
      '接入',
      '重构',
      '删除',
      '移除',
      '更新',
      '改',
      '写',
    ]);
  }

  private hasInspectionIntent(message: string): boolean {
    return this.includesAny(message, [
      'inspect',
      'explain',
      'find',
      'read',
      'search',
      'show',
      'where',
      '分析',
      '查看',
      '看看',
      '解释',
      '找',
      '阅读',
      '梳理',
    ]);
  }

  private includesAny(message: string, terms: string[]): boolean {
    return terms.some((term) => message.includes(term));
  }

  private normalize(message: string): string {
    return message.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
