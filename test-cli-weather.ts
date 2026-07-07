#!/usr/bin/env tsx

/**
 * Test the weather server with the main CLI
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

async function testCliWeather() {
  console.log('🌤️  Testing Weather Server with CLI\n');

  // Create a temporary MCP config for testing
  const testConfig = {
    servers: {
      'weather': {
        command: 'node',
        args: ['weather-server.js'],
        env: {
          API_KEY: 'test-key'
        }
      }
    }
  };

  writeFileSync('./test-mcp-config.json', JSON.stringify(testConfig, null, 2));

  console.log('📋 Starting CLI with weather MCP server...');
  
  const cli = spawn('bun', ['./src/cli.ts', '--mcp-config', './test-mcp-config.json'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: process.cwd()
  });

  let output = '';
  
  cli.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log('CLI Output:', text);
  });

  // Wait for CLI to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Send a weather query
  console.log('\n🌡️  Sending weather query...');
  cli.stdin.write('Get the weather for Beijing\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Send forecast query
  console.log('\n📅 Sending forecast query...');
  cli.stdin.write('Get a 5-day forecast for Tokyo\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Exit
  cli.stdin.write('/exit\n');

  cli.on('close', (code) => {
    console.log(`\n🏁 CLI exited with code ${code}`);
    
    // Clean up
    try {
      require('fs').unlinkSync('./test-mcp-config.json');
    } catch (e) {
      // Ignore cleanup errors
    }
    
    if (output.includes('weather') || output.includes('temperature')) {
      console.log('✅ Weather functionality appears to be working!');
    } else {
      console.log('⚠️  No weather data detected in output');
    }
  });

  // Handle timeout
  setTimeout(() => {
    console.log('\n⏰ Test timeout, killing CLI...');
    cli.kill();
  }, 20000);
}

testCliWeather().catch(console.error);