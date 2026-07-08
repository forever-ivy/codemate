#!/usr/bin/env tsx

/**
 * Quick test to verify npm run dev works with weather server
 */

import { spawn } from 'child_process';

async function testDev() {
  console.log('🚀 Testing npm run dev with weather server...\n');

  const dev = spawn('npm', ['run', 'dev', 'chat'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: process.cwd()
  });

  let output = '';
  let hasWeatherServer = false;
  let hasError = false;

  dev.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log('DEV OUTPUT:', text);
    
    if (text.includes('test-weather-server')) {
      hasWeatherServer = true;
    }
    
    if (text.includes('ENOENT') || text.includes('spawn python')) {
      hasError = true;
    }
  });

  // Wait for startup
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Send exit command
  dev.stdin.write('/exit\n');

  dev.on('close', (code) => {
    console.log(`\n🏁 Dev process exited with code ${code}`);
    
    if (hasError) {
      console.log('❌ Still has Python/file-server errors');
    } else if (hasWeatherServer) {
      console.log('✅ Weather server loaded successfully!');
    } else {
      console.log('⚠️  Weather server not detected in output');
    }
    
    console.log('\nOutput summary:');
    console.log('- Weather server detected:', hasWeatherServer);
    console.log('- Python errors:', hasError);
  });

  // Timeout
  setTimeout(() => {
    console.log('\n⏰ Timeout, killing process...');
    dev.kill();
  }, 15000);
}

testDev().catch(console.error);