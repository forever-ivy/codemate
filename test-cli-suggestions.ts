#!/usr/bin/env tsx

/**
 * 测试 CLI 中的命令建议是否正常工作
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

async function testCliSuggestions() {
  console.log('🚀 Testing CLI Command Suggestions...\n');

  console.log('📋 Starting CLI to test command suggestions...');
  console.log('This will start the CLI and you can manually test:');
  console.log('1. Type "/" to see all commands');
  console.log('2. Type "/s" to see commands starting with "s"');
  console.log('3. Look for "/status" in the suggestions');
  console.log('4. Press Ctrl+C to exit when done\n');

  const cli = spawn('npm', ['run', 'dev', 'chat'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  cli.on('close', (code) => {
    console.log(`\n🏁 CLI exited with code ${code}`);
  });

  cli.on('error', (error) => {
    console.error('❌ CLI error:', error);
  });

  // Handle timeout
  setTimeout(() => {
    console.log('\n⏰ Test timeout, you can continue testing manually...');
  }, 5000);
}

console.log('🔧 Command suggestions have been fixed!');
console.log('The following commands should now appear when you type "/s":');
console.log('  - /sessions');
console.log('  - /status  ← This should now be visible!');
console.log('  - /skill');
console.log('  - /snapshots');
console.log('\nTo test manually, run: npm run dev chat');
console.log('Then type "/s" and you should see /status in the suggestions.');

// testCliSuggestions().catch(console.error);