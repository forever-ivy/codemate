#!/usr/bin/env npx tsx

/**
 * 直接测试 WorkspaceCommand 功能
 */

import { WorkspaceCommand } from './src/commands/workspace/WorkspaceCommand.js';
import { ConfigManager } from './src/config/ConfigManager.js';

async function testWorkspaceCommand() {
  console.log('🧪 Testing WorkspaceCommand directly...\n');

  // 创建配置管理器
  const configManager = new ConfigManager({
    cwd: process.cwd(),
    productName: 'aicli'
  });

  // 创建 WorkspaceCommand 实例
  const workspaceCommand = new WorkspaceCommand(configManager);

  console.log('1️⃣ 测试 /workspace create（不提供 --name）');
  console.log('Expected: 显示错误信息和使用说明');
  try {
    await workspaceCommand.execute(['create']);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('2️⃣ 测试 /workspace create --name feature-auth');
  console.log('Expected: 成功创建工作区');
  try {
    await workspaceCommand.execute(['create', '--name', 'feature-auth']);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('3️⃣ 测试 /workspace create --name feature-auth-2 -b develop');
  console.log('Expected: 显示基础分支不存在的错误');
  try {
    await workspaceCommand.execute(['create', '--name', 'feature-auth-2', '-b', 'develop']);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('4️⃣ 测试 /workspace create --name feature-auth-2 -b main');
  console.log('Expected: 成功创建工作区（指定有效基础分支）');
  try {
    await workspaceCommand.execute(['create', '--name', 'feature-auth-2', '-b', 'main']);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('5️⃣ 测试 /workspace list');
  console.log('Expected: 列出所有工作区');
  try {
    await workspaceCommand.execute(['list']);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('6️⃣ 测试显示帮助');
  console.log('Expected: 显示命令使用说明');
  try {
    await workspaceCommand.execute([]);
  } catch (error) {
    console.error('Error:', error.message);
  }
  console.log('');

  console.log('✅ WorkspaceCommand 测试完成！');
}

// 运行测试
testWorkspaceCommand().catch(console.error);