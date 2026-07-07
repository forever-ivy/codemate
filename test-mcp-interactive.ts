#!/usr/bin/env bun

/**
 * MCP命令交互式界面演示脚本
 * 
 * 这个脚本演示了输入 /mcp 命令后的交互式界面效果
 */

import { Application } from './src/application/Application';
import { Container } from './src/application/Container';

async function testMCPInteractive() {
  console.log('🚀 启动MCP命令交互式界面演示...\n');

  try {
    // 创建应用容器
    const container = new Container();
    
    // 创建应用实例
    const app = new Application(container);
    
    console.log('✅ 应用初始化完成');
    console.log('📋 MCP配置文件: ./mcp.json');
    console.log('🎯 演示MCP命令界面');
    console.log('');
    
    // 获取命令管理器并执行MCP命令
    const commandManager = app.getContainer().get('command');
    const mcpCommand = commandManager.getCommand('mcp');
    
    if (mcpCommand) {
      console.log('> /mcp');
      console.log('');
      
      // 执行MCP命令
      await mcpCommand.execute([], app);
    } else {
      console.log('❌ MCP命令未找到');
    }
    
    // 等待一段时间让界面渲染
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📝 界面说明:');
    console.log('- 🟢 绿色圆点: 服务器已连接');
    console.log('- 🟡 黄色圆点: 服务器连接中');
    console.log('- 🔴 红色圆点: 服务器连接失败');
    console.log('- ↑↓ 键: 导航选择服务器');
    console.log('- Space 键: 展开/收起工具列表');
    console.log('- Enter 键: 重新连接失败的服务器');
    console.log('- q/ESC 键: 退出MCP管理界面');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testMCPInteractive().catch(console.error);