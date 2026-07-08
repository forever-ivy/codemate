#!/usr/bin/env tsx

/**
 * Simple test to verify weather tools are available in CLI
 */

import { Container } from './src/application/Container.js';

async function testWeatherTools() {
  console.log('🌤️  Testing Weather Tools in CLI\n');

  try {
    // Initialize the container (same as CLI does)
    const container = new Container();
    await container.initialize();

    // Get the tool manager
    const toolManager = container.get('tool');
    const tools = await toolManager.getTools();

    console.log(`📋 Total tools available: ${tools.length}`);
    
    // Find weather tools
    const weatherTools = tools.filter(tool => 
      tool.name.includes('weather') || tool.name.includes('forecast')
    );

    console.log(`🌡️  Weather tools found: ${weatherTools.length}`);
    
    for (const tool of weatherTools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }

    if (weatherTools.length > 0) {
      console.log('\n✅ Weather MCP integration successful!');
      
      // Test calling a weather tool
      const weatherTool = weatherTools.find(t => t.name.includes('get_weather'));
      if (weatherTool) {
        console.log('\n🧪 Testing weather tool execution...');
        try {
          const result = await weatherTool.execute({
            city: 'Beijing',
            units: 'celsius'
          });
          console.log('Weather result:', result.content);
          console.log('✅ Weather tool execution successful!');
        } catch (error) {
          console.error('❌ Weather tool execution failed:', error);
        }
      }
    } else {
      console.log('❌ No weather tools found');
    }

    // Cleanup
    const mcpManager = container.get('mcpManager');
    await mcpManager.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testWeatherTools();