#!/usr/bin/env node

/**
 * 测试交互式Help命令
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testInteractiveHelp() {
  console.log('🧪 Testing Interactive Help Command...\n');

  // 启动CLI进程
  const cli = spawn('node', ['dist/cli.js', 'chat'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  let output = '';
  
  cli.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log('STDOUT:', text);
  });

  cli.stderr.on('data', (data) => {
    const text = data.toString();
    console.log('STDERR:', text);
  });

  // 等待CLI启动
  await setTimeout(2000);

  console.log('\n📝 Sending /help command...');
  cli.stdin.write('/help\n');

  // 等待响应
  await setTimeout(3000);

  console.log('\n📝 Sending /help model command...');
  cli.stdin.write('/help model\n');

  // 等待响应
  await setTimeout(2000);

  console.log('\n📝 Sending /exit command...');
  cli.stdin.write('/exit\n');

  // 等待进程结束
  await setTimeout(1000);

  cli.kill();
  
  console.log('\n✅ Test completed');
}

testInteractiveHelp().catch(console.error);