#!/usr/bin/env bun

/**
 * 测试Clear命令的完全对标实现
 */

import { Container } from './src/application/Container';
import { Paths } from './src/services/Paths';
import { EventBus } from './src/services/EventBus';
import { SessionService } from './src/services/SessionService';
import { ClearCommand } from './src/commands/session/ClearCommand';
import { SlashCommandManager } from './src/managers/SlashCommandManager';

async function testClearCommand() {
  console.log('🧪 测试Clear命令对标实现...\n');

  try {
    // 创建简化的容器和服务
    const container = new Container();
    
    // 创建基础服务
    const eventBus = new EventBus();
    const paths = new Paths({
      productName: 'aicli',
      cwd: process.cwd(),
    });
    const sessionService = new SessionService(paths, eventBus);
    
    // 注册服务
    container.register('eventBus', eventBus);
    container.register('paths', paths);
    container.register('session', sessionService);
    
    // 创建命令管理器
    const commandManager = new SlashCommandManager();
    container.register('command', commandManager);
    
    // 初始化SessionService
    await sessionService.initialize();
    
    // 创建一个会话
    await sessionService.create();
    
    // 创建模拟的Application对象
    const mockApp = {
      getContainer: () => container
    };
    
    // 1. 添加一些测试消息
    console.log('📝 添加测试消息...');
    await sessionService.addMessage({
      role: 'user',
      content: 'Test message 1'
    });
    
    await sessionService.addMessage({
      role: 'assistant',
      content: 'Test response 1'
    });
    
    await sessionService.addMessage({
      role: 'user',
      content: 'Test message 2'
    });
    
    const beforeClear = sessionService.getCurrent();
    console.log(`   当前会话ID: ${beforeClear?.id}`);
    console.log(`   消息数量: ${beforeClear?.messages.length || 0}\n`);
    
    // 2. 执行clear命令
    console.log('🧹 执行clear命令...');
    const clearCommand = new ClearCommand();
    await clearCommand.execute([], mockApp as any);
    
    // 3. 验证结果
    console.log('\n✅ 验证结果:');
    const afterClear = sessionService.getCurrent();
    console.log(`   新会话ID: ${afterClear?.id}`);
    console.log(`   消息数量: ${afterClear?.messages.length || 0}`);
    console.log(`   会话是否改变: ${beforeClear?.id !== afterClear?.id ? '是' : '否'}`);
    
    // 4. 验证输出格式
    console.log('\n📋 输出格式验证:');
    console.log('   期望格式: Messages cleared, new session id: [session-id]');
    console.log('   实际输出: 见上方命令执行结果');
    
    // 5. 性能测试
    console.log('\n⚡ 性能测试:');
    const startTime = Date.now();
    await clearCommand.execute([], mockApp as any);
    const endTime = Date.now();
    console.log(`   执行时间: ${endTime - startTime}ms`);
    
    console.log('\n🎉 Clear命令测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testClearCommand();