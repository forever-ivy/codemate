#!/usr/bin/env node

/**
 * 测试 workspace 命令的交互式脚本
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testWorkspaceCommands() {
  console.log('🧪 Testing Workspace Commands...\n');

  // 启动 CLI 进程
  const cli = spawn('npx', ['tsx', 'src/cli.ts'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  
  cli.stdout.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data);
  });

  cli.stderr.on('data', (data) => {
    output += data.toString();
    process.stderr.write(data);
  });

  // 等待 CLI 启动
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n1️⃣ 测试 /workspace create（不提供 --name）');
  cli.stdin.write('/workspace create\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n2️⃣ 测试 /workspace create --name feature-auth');
  cli.stdin.write('/workspace create --name feature-auth\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n3️⃣ 测试 /workspace list');
  cli.stdin.write('/workspace list\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n4️⃣ 测试 /workspace create --name feature-auth -b develop');
  cli.stdin.write('/workspace create --name feature-auth-2 -b develop\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n5️⃣ 退出');
  cli.stdin.write('exit\n');

  cli.on('close', (code) => {
    console.log(`\n✅ CLI 进程退出，代码: ${code}`);
    process.exit(0);
  });

  // 超时保护
  setTimeout(() => {
    console.log('\n⏰ 测试超时，强制退出');
    cli.kill();
    process.exit(1);
  }, 30000);
}

testWorkspaceCommands().catch(console.error);