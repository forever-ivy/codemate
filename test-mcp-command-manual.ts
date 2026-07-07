import { Application } from './src/application/Application';
import type { SlashCommandManager } from './src/managers/SlashCommandManager';
import type { MCPManager } from './src/mcp/MCPManager';

async function testMCPCommand() {
  console.log('🧪 Testing MCP Command Implementation...\n');

  const app = new Application();
  // Application在构造函数中已经完成初始化

  try {
    // 测试1：命令注册
    console.log('Test 1: Command Registration');
    const commandManager = app.getContainer().get<SlashCommandManager>('command');
    const command = commandManager.get('mcp');
    
    if (command) {
      console.log('✅ MCP command registered successfully');
      console.log(`   Name: ${command.name}`);
      console.log(`   Description: ${command.description}`);
    } else {
      console.log('❌ MCP command not found');
      return;
    }

    // 测试2：命令列表
    console.log('\nTest 2: Command List');
    const commands = commandManager.list();
    if (commands.includes('mcp')) {
      console.log('✅ MCP command appears in command list');
    } else {
      console.log('❌ MCP command missing from command list');
    }

    // 测试3：MCP管理器状态
    console.log('\nTest 3: MCP Manager Status');
    const mcpManager = app.getContainer().get<MCPManager>('mcpManager');
    if (mcpManager) {
      const status = mcpManager.getServerStatus();
      console.log('✅ MCP Manager accessible');
      console.log(`   Ready: ${status.isReady}`);
      console.log(`   Loading: ${status.isLoading}`);
      console.log(`   Servers: ${Object.keys(status.servers).length}`);
      
      // 显示服务器详情
      for (const [name, serverInfo] of Object.entries(status.servers)) {
        console.log(`   - ${name}: ${serverInfo.status} (${serverInfo.toolCount} tools)`);
      }
    } else {
      console.log('❌ MCP Manager not found');
    }

    // 测试4：执行命令
    console.log('\nTest 4: Command Execution');
    try {
      const result = await commandManager.execute('/mcp', app);
      if (result) {
        console.log('✅ MCP command executed successfully');
        console.log('   Event should be emitted to show MCP manager UI');
      } else {
        console.log('❌ MCP command execution failed');
      }
    } catch (error) {
      console.log('❌ MCP command execution error:', error);
    }

    // 测试5：事件总线
    console.log('\nTest 5: Event Bus Integration');
    const eventBus = app.getContainer().get('eventBus');
    let eventReceived = false;
    
    const unsubscribe = eventBus.on('show_mcp_manager', () => {
      eventReceived = true;
      console.log('✅ show_mcp_manager event received');
    });

    // 再次执行命令测试事件
    await commandManager.execute('/mcp', app);
    
    setTimeout(() => {
      if (eventReceived) {
        console.log('✅ Event system working correctly');
      } else {
        console.log('❌ Event not received');
      }
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }, 100);

    // 测试6：配置路径
    console.log('\nTest 6: Configuration Paths');
    try {
      const configService = app.getContainer().get('config');
      if (configService) {
        console.log('✅ Config service accessible');
        console.log(`   Global config: ${configService.getGlobalConfigPath()}`);
        console.log(`   Project config: ${configService.getProjectConfigPath()}`);
      } else {
        console.log('⚠️  Config service not found (this is expected if no config was provided)');
      }
    } catch (error) {
      console.log('⚠️  Config service not available (this is expected if no config was provided)');
    }

    console.log('\n✅ All MCP Command tests completed!');
    console.log('\n💡 To test the UI interactively:');
    console.log('   1. Run: bun ./src/cli.ts');
    console.log('   2. Type: /mcp');
    console.log('   3. Use ↑↓ to navigate, Space to expand, Enter to reconnect, q to exit');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Application没有cleanup方法，直接结束
    console.log('🔄 Test cleanup completed');
  }
}

// 运行测试
testMCPCommand().catch(console.error);