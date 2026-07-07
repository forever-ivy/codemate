import { Application } from './src/application/Application';
import type { AgentManager } from './src/managers/AgentManager';

async function testAgents() {
  console.log('🧪 开始手动测试 Agent...\n');

  // 1. 创建应用
  const app = new Application({
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseURL: 'https://api.deepseek.com',
  });

  // 2. 获取 AgentManager
  const agentManager = app.getAgentManager()!;

  // 3. 列出所有 Agent
  console.log('📋 已注册的 Agent:');
  const agents = agentManager.getAllInfo();
  for (const agent of agents) {
    console.log(`  - ${agent.name}: ${agent.description}`);
    console.log(`    何时使用: ${agent.whenToUse}`);
  }
  console.log('');

  // 4. 测试 ExploreAgent
  console.log('🔍 测试 ExploreAgent...');
  try {
    const exploreResult = await agentManager.delegate(
      {
        type: 'explore',
        goal: '查找所有 TypeScript 文件',
      },
      'explore',
    );
    if (exploreResult.success) {
      console.log('结果:', exploreResult.data.summary);
    } else {
      console.log('失败:', exploreResult.error?.message);
    }
  } catch (error) {
    console.error('失败:', error);
  }
  console.log('');

  // 5. 测试 PlanAgent
  console.log('📋 测试 PlanAgent...');
  try {
    const planResult = await agentManager.delegate(
      {
        type: 'plan',
        goal: '创建一个新的工具类',
      },
      'plan',
    );
    console.log('计划:\n', planResult.data.plan);
  } catch (error) {
    console.error('失败:', error);
  }
  console.log('');

  // 6. 测试 GeneralAgent
  console.log('⚙️  测试 GeneralAgent...');
  try {
    const generalResult = await agentManager.delegate(
      {
        type: 'execute',
        goal: '读取 package.json 文件',
        context: {
          path: 'package.json',
        },
      },
      'general-purpose',
    );
    console.log('结果:', generalResult.success ? '成功' : '失败');
  } catch (error) {
    console.error('失败:', error);
  }
  console.log('');

  // 7. 测试多 Agent 协作
  console.log('🤝 测试多 Agent 协作...');
  try {
    // 探索
    const explore = await agentManager.delegate(
      {
        type: 'explore',
        goal: '理解项目结构',
      },
      'explore',
    );

    // 规划
    const plan = await agentManager.delegate(
      {
        type: 'plan',
        goal: '添加新功能',
        context: explore.data,
      },
      'plan',
    );

    // 执行
    const execute = await agentManager.delegate(
      {
        type: 'execute',
        goal: '读取 package.json 文件',
        context: {
          path: 'package.json',
        },
      },
      'general-purpose',
    );

    console.log('协作完成:', execute.success ? '成功' : '失败');
  } catch (error) {
    console.error('失败:', error);
  }

  console.log('\n✅ 所有 Agent 测试完成！');
}

testAgents().catch(console.error);