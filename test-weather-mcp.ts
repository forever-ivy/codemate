#!/usr/bin/env tsx

/**
 * Weather MCP Server Test Script
 * 
 * Tests the weather server through the MCP Manager
 */

import { MCPManager } from './src/mcp/MCPManager.js';

async function main() {
  console.log('🌤️  Testing Weather MCP Server\n');

  const mcpManager = new MCPManager();

  try {
    // Initialize with our weather-only config
    await mcpManager.initialize('./mcp-weather-only.json');

    // List all available tools
    const tools = mcpManager.getTools();
    console.log(`\n📋 Available MCP Tools (${tools.length}):`);
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }

    // Find weather tools
    const weatherTool = tools.find(t => t.name.includes('get_weather'));
    const forecastTool = tools.find(t => t.name.includes('get_forecast'));

    if (weatherTool) {
      console.log(`\n🌡️  Testing ${weatherTool.name}...`);
      try {
        const result = await weatherTool.execute({
          city: 'Beijing',
          units: 'celsius'
        });
        console.log('Weather Result:', result);
      } catch (error) {
        console.error('Weather tool error:', error);
      }
    } else {
      console.log('\n⚠️  Weather tool not found');
    }

    if (forecastTool) {
      console.log(`\n📅 Testing ${forecastTool.name}...`);
      try {
        const result = await forecastTool.execute({
          city: 'Shanghai',
          days: 3
        });
        console.log('Forecast Result:', result);
      } catch (error) {
        console.error('Forecast tool error:', error);
      }
    } else {
      console.log('\n⚠️  Forecast tool not found');
    }

    // Test with different cities
    if (weatherTool) {
      console.log('\n🌍 Testing different cities...');
      const cities = ['New York', 'London', 'Tokyo'];
      
      for (const city of cities) {
        try {
          const result = await weatherTool.execute({
            city,
            units: 'fahrenheit'
          });
          console.log(`${city}:`, result);
        } catch (error) {
          console.error(`Error getting weather for ${city}:`, error);
        }
      }
    }

    console.log('\n✅ Weather MCP tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Make sure:');
    console.error('1. weather-server.js exists and is executable');
    console.error('2. mcp.json is configured correctly');
    console.error('3. Node.js can run the weather server');
    process.exit(1);
  } finally {
    await mcpManager.disconnect();
  }
}

main();