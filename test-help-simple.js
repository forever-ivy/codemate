#!/usr/bin/env node

/**
 * 简单测试Help命令的行为
 */

import { spawn } from 'child_process';

async function testHelpCommand() {
  console.log('🧪 Testing Help Command...\n');

  return new Promise((resolve) => {
    // 启动CLI进程，发送help命令然后立即退出
    const cli = spawn('node', ['dist/cli.js', 'chat'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let hasStarted = false;
    
    cli.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // 等待CLI完全启动
      if (text.includes('✅ Loaded latest session') && !hasStarted) {
        hasStarted = true;
        console.log('📝 CLI started, sending /help command...');
        
        // 发送help命令
        cli.stdin.write('/help\n');
        
        // 等待一下然后退出
        setTimeout(() => {
          cli.stdin.write('/exit\n');
          setTimeout(() => {
            cli.kill();
            resolve();
          }, 500);
        }, 1000);
      }
    });

    cli.stderr.on('data', (data) => {
      const text = data.toString();
      // 只显示重要的错误，忽略Ink的raw mode警告
      if (!text.includes('Raw mode is not supported') && !text.includes('EnhancedInput')) {
        console.log('STDERR:', text);
      }
    });

    cli.on('close', (code) => {
      console.log(`\n📊 Process exited with code: ${code}`);
      
      // 分析输出
      if (output.includes('📚 Available Commands:')) {
        console.log('✅ Help command shows command list');
      } else if (output.includes('Command UI session started')) {
        console.log('✅ Help command uses enhanced UI system');
      } else {
        console.log('❌ Help command behavior unclear');
      }
      
      resolve();
    });
  });
}

testHelpCommand().then(() => {
  console.log('\n✅ Test completed');
}).catch(console.error);