import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'pathe';
import { AgentManager } from '../../src/managers/AgentManager';
import { AgentSource } from '../../src/types/index';

describe('Agent Integration (Enhanced)', () => {
  const testDir = join(process.cwd(), '.test-agents');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load agents from directory', async () => {
    // 创建测试 Agent 文件
    const agentContent = `---
name: test-agent
description: Test agent
tools: read, glob
disallowedTools: bash
model: claude-3-5-sonnet
forkContext: true
color: blue
---

You are a test agent.`;

    await writeFile(join(testDir, 'test-agent.md'), agentContent);

    // 加载 Agent
    const mockContext: any = {
      toolManager: { list: () => [], getAllTools: () => [] },
      modelService: {},
      sessionService: {},
      eventBus: {},
    };

    const agentManager = new AgentManager(mockContext);

    // 使用私有方法的变通方案：直接调用 loadFromDirectory
    // @ts-ignore - 访问私有方法用于测试
    await agentManager.loadFromDirectory(testDir, AgentSource.Project);

    // 验证
    expect(agentManager.has('test-agent')).toBe(true);
    const agent = agentManager.get('test-agent');
    expect(agent?.name).toBe('test-agent');
    expect(agent?.description).toBe('Test agent');
  });

  it('should handle agent priority correctly', async () => {
    const globalDir = join(testDir, 'global');
    const projectDir = join(testDir, 'project');

    await mkdir(globalDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    // 创建全局 Agent
    await writeFile(
      join(globalDir, 'test.md'),
      `---
name: test
description: Global agent
---
Global`
    );

    // 创建项目 Agent
    await writeFile(
      join(projectDir, 'test.md'),
      `---
name: test
description: Project agent
---
Project`
    );

    const mockContext: any = {
      toolManager: { list: () => [], getAllTools: () => [] },
      modelService: {},
      sessionService: {},
      eventBus: {},
    };

    const agentManager = new AgentManager(mockContext);

    // 先加载全局，再加载项目
    // @ts-ignore
    await agentManager.loadFromDirectory(globalDir, AgentSource.Global);
    // @ts-ignore
    await agentManager.loadFromDirectory(projectDir, AgentSource.Project);

    // 验证：项目 Agent 应该覆盖全局 Agent
    const agent = agentManager.get('test');
    expect(agent?.description).toBe('Project agent');
  });

  it('should parse tools as string or array', async () => {
    // 测试字符串格式
    const agentContent1 = `---
name: test1
description: Test 1
tools: read, write, glob
---
Test 1`;

    await writeFile(join(testDir, 'test1.md'), agentContent1);

    // 测试数组格式
    const agentContent2 = `---
name: test2
description: Test 2
tools:
  - read
  - write
  - glob
---
Test 2`;

    await writeFile(join(testDir, 'test2.md'), agentContent2);

    const mockContext: any = {
      toolManager: { list: () => ['read', 'write', 'glob'], getAllTools: () => [] },
      modelService: {},
      sessionService: {},
      eventBus: {},
    };

    const agentManager = new AgentManager(mockContext);
    // @ts-ignore
    await agentManager.loadFromDirectory(testDir, AgentSource.Project);

    // 验证两种格式都能正确解析
    const tools1 = agentManager.getAvailableTools('test1');
    const tools2 = agentManager.getAvailableTools('test2');

    expect(tools1).toEqual(['read', 'write', 'glob']);
    expect(tools2).toEqual(['read', 'write', 'glob']);
  });
});
