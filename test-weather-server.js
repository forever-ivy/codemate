#!/usr/bin/env node

/**
 * Test script for the weather server
 */

import { spawn } from 'child_process';

function testWeatherServer() {
  console.log('🌤️  Testing Weather Server...\n');
  
  const server = spawn('node', ['weather-server.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let responses = [];
  
  server.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          responses.push(response);
          console.log('📨 Received:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('📨 Raw output:', line);
        }
      }
    });
  });

  // Test sequence
  const tests = [
    // Initialize
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    },
    // List tools
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    },
    // Get weather for Beijing
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_weather',
        arguments: {
          city: 'Beijing',
          units: 'celsius'
        }
      }
    },
    // Get forecast for Shanghai
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_forecast',
        arguments: {
          city: 'Shanghai',
          days: 5
        }
      }
    }
  ];

  let testIndex = 0;
  
  function sendNextTest() {
    if (testIndex < tests.length) {
      const test = tests[testIndex++];
      console.log(`\n🚀 Sending test ${testIndex}:`, JSON.stringify(test, null, 2));
      server.stdin.write(JSON.stringify(test) + '\n');
      
      // Send next test after a delay
      setTimeout(sendNextTest, 1000);
    } else {
      // All tests sent, wait a bit then close
      setTimeout(() => {
        console.log('\n✅ All tests completed!');
        server.kill();
      }, 2000);
    }
  }

  // Start testing after server initializes
  setTimeout(sendNextTest, 500);

  server.on('close', (code) => {
    console.log(`\n🏁 Weather server exited with code ${code}`);
    process.exit(0);
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
  });
}

testWeatherServer();