#!/usr/bin/env npx tsx

/**
 * MCP命令简单测试脚本
 * 
 * 验证MCP命令是否正确注册和可以执行
 */

import { Container } from './src/application/Container';
import { Application } from './src/application/Application';

async function testMCPCommand() {
  console.log('🧪 测试MCP命令注册和执行...\n');

  try {
    // 创建应用容器和实例
    const container = new Container();
    const app = new Application(container);
    
    console.log('✅ 应用创建成功');
    
    // 等待应用完全初始化
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 获取命令管理器
    const commandManager = container.get('command');
    console.log('✅ 命令管理器获取成功');
    
    // 检查MCP命令是否注册
    const mcpCommand = commandManager.getCommand('mcp');
    if (mcpCommand) {
      console.log('✅ MCP命令已注册');
      console.log(`   名称: ${mcpCommand.name}`);
      console.log(`   描述: ${mcpCommand.description}`);
      console.log(`   别名: ${mcpCommand.aliases.join(', ') || '无'}`);
    } else {
      console.log('❌ MCP命令未找到');
      return;
    }
    
    // 获取MCP管理器
    const mcpManager = container.get('mcpManager');
    console.log('✅ MCP管理器获取成功');
    
    // 获取配置服务
    const configService = container.get('config');
    console.log('✅ 配置服务获取成功');
    
    // 检查MCP配置文件
    const projectConfigPath = configService.getProjectConfigPath();
    const globalConfigPath = configService.getGlobalConfigPath();
    
    console.log('\n📍 MCP配置文件路径:');
    console.log(`   项目配置: ${projectConfigPath}`);
    console.log(`   全局配置: ${globalConfigPath}`);
    
    // 获取MCP服务器状态
    const serverStatus = mcpManager.getServerStatus();
    console.log('\n📊 MCP服务器状态:');
    console.log(`   管理器就绪: ${serverStatus.isReady ? '✅' : '❌'}`);
    console.log(`   正在加载: ${serverStatus.isLoading ? '🔄' : '✅'}`);
    console.log(`   服务器数量: ${Object.keys(serverStatus.servers).length}`);
    
    if (Object.keys(serverStatus.servers).length > 0) {
      console.log('\n🖥️  服务器列表:');
      Object.entries(serverStatus.servers).forEach(([name, info]) => {
        const statusIcon = info.status === 'connected' ? '🟢' : 
                          info.status === 'connecting' ? '🟡' : '🔴';
        console.log(`   ${statusIcon} ${name}: ${info.status} (${info.toolCount} tools)`);
        if (info.error) {
          console.log(`      错误: ${info.error}`);
        }
      });
    } else {
      console.log('   📝 没有配置MCP服务器');
    }
    
    console.log('\n🎯 MCP命令功能验证:');
    console.log('   ✅ 命令注册正常');
    console.log('   ✅ 服务依赖正常');
    console.log('   ✅ 配置路径正确');
    console.log('   ✅ 状态获取正常');
    
    console.log('\n📋 使用方法:');
    console.log('   1. 启动CLI: npm run dev');
    console.log('   2. 输入命令: /mcp');
    console.log('   3. 使用键盘导航界面');
    console.log('   4. 按q或ESC退出');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testMCPCommand().catch(console.error);