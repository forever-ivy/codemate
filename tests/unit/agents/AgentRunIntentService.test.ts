import { describe, expect, it } from 'vitest';
import { AgentRunIntentService } from '../../../src/agents/AgentRunIntentService';

describe('AgentRunIntentService', () => {
  const service = new AgentRunIntentService();

  it('should classify broad code-changing requests without relying on one fixed phrase', () => {
    const messages = [
      '给后台新增一个订单菜单',
      'add a customer table to the dashboard',
      'fix the login form validation',
      'update package metadata',
      '实现第98章代码和教程',
      'refactor the approval flow',
    ];

    for (const message of messages) {
      const decision = service.classify(message);

      expect(decision.intent).toBe('code-change');
      expect(decision.requiresFileChange).toBe(true);
      expect(decision.requiresVerification).toBe(true);
      expect(decision.reason.length).toBeGreaterThan(0);
    }
  });

  it('should classify repository inspection without requiring edits', () => {
    const decision = service.classify('帮我看看 AgentLoop 是怎么工作的');

    expect(decision.intent).toBe('inspect-only');
    expect(decision.requiresFileChange).toBe(false);
    expect(decision.requiresVerification).toBe(false);
  });

  it('should classify general explanation as answer-only', () => {
    const decision = service.classify('什么是 coding agent');

    expect(decision.intent).toBe('answer-only');
    expect(decision.requiresFileChange).toBe(false);
    expect(decision.requiresVerification).toBe(false);
  });
});
