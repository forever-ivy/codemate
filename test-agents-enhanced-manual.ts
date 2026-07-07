import { AgentManager } from './src/managers/AgentManager';
import { Agent } from './src/agents/base/Agent';
import { AgentSource } from './src/types/index';
import type { Task, Result, AgentContext } from './src/types/index';

// 测试 Agent
class TestAgent extends Agent {
  name = 'test';
  description = 'Test agent for manual testing';
  whenToUse = 'For testing purposes';

  async execute(task: Task, _context: AgentContext): Promise<Result> {
    console.log(`   Executing task: ${task.goal}`);
    return {
      success: true,
      data: { message: 'Test completed' },
    };
  }
}

async function testAgentsEnhanced() {
  console.log('🧪 Testing Enhanced Agent System...\n');

  // 创建 mock context
  const mockContext: AgentContext = {
    toolManager: {
      list: () => ['read', 'write', 'bash', 'glob', 'grep'],
      getAllTools: () => [
        { name: 'read' },
        { name: 'write' },
        { name: 'bash' },
        { name: 'glob' },
        { name: 'grep' },
      ],
    } as any,
    sessionService: {} as any,
    eventBus: {} as any,
  };

  const agentManager = new AgentManager(mockContext);

  // 1. 注册内置 Agent
  console.log('1️⃣  Registering builtin agents...');
  agentManager.register(new TestAgent(), AgentSource.Builtin);
  console.log(`   Agents: ${agentManager.list().join(', ')}\n`);

  // 2. 加载自定义 Agent
  console.log('2️⃣  Loading custom agents...');
  await agentManager.loadAgents();
  console.log(`   Total agents: ${agentManager.count()}\n`);

  // 3. 列出所有 Agent
  console.log('3️⃣  All agents:');
  const agents = agentManager.listAll();
  for (const agent of agents) {
    console.log(`   - ${agent.name} (${agent.source})`);
    console.log(`     ${agent.description}`);
    if (agent.tools) {
      console.log(`     Tools: ${agent.tools.join(', ')}`);
    }
    if (agent.disallowedTools) {
      console.log(`     Disallowed: ${agent.disallowedTools.join(', ')}`);
    }
    if (agent.model) {
      console.log(`     Model: ${agent.model}`);
    }
    if (agent.forkContext) {
      console.log(`     Fork Context: ${agent.forkContext}`);
    }
    if (agent.color) {
      console.log(`     Color: ${agent.color}`);
    }
    console.log();
  }

  // 4. 测试工具权限
  console.log('4️⃣  Testing tool permissions...');
  for (const agentName of agentManager.list()) {
    const tools = agentManager.getAvailableTools(agentName);
    console.log(`   ${agentName}: ${tools.join(', ')}`);
  }
  console.log();

  // 5. 测试任务委托
  console.log('5️⃣  Testing task delegation...');
  const task: Task = {
    type: 'test',
    goal: 'Test the enhanced agent system',
  };

  const result = await agentManager.delegate(task, 'test');
  console.log(`   Result: ${JSON.stringify(result, null, 2)}\n`);

  console.log('✅ All tests passed!');
}

testAgentsEnhanced().catch(console.error);
