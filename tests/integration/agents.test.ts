import { describe, it, expect, beforeEach } from 'vitest';
import { Application } from '../../src/application/Application';
import type { AgentManager } from '../../src/managers/AgentManager';

describe('Agents Integration', () => {
  let app: Application;
  let agentManager: AgentManager;

  beforeEach(() => {
    app = new Application({
      model: 'deepseek-chat',
      apiKey: 'test-key',
      baseURL: 'https://api.deepseek.com',
    });

    agentManager = app.getAgentManager()!;
  });

  it('should have explore agent registered', () => {
    expect(agentManager.has('explore')).toBe(true);
  });

  it('should have plan agent registered', () => {
    expect(agentManager.has('plan')).toBe(true);
  });

  it('should have general-purpose agent registered', () => {
    expect(agentManager.has('general-purpose')).toBe(true);
  });

  it('should list all agents', () => {
    const agents = agentManager.list();
    expect(agents).toContain('explore');
    expect(agents).toContain('plan');
    expect(agents).toContain('general-purpose');
  });

  it('should get agent info', () => {
    const info = agentManager.getAllInfo();
    expect(info).toHaveLength(3);
  });
});
