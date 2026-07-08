#!/usr/bin/env bun

/**
 * 手动测试 Spec 头脑风暴命令
 * 
 * 运行方式：
 * bun test-spec-brainstorm-manual.ts
 */

import { Application } from './src/application/Application.js';

async function testSpecBrainstorm() {
  console.log('🧪 测试 Spec 头脑风暴命令\n');

  try {
    // 1. 创建应用实例（简化版本，不使用配置）
    const app = new Application();
    
    // 2. 启动应用
    console.log('🚀 启动应用...');
    await app.start();
    
    // 3. 获取命令管理器
    const commandManager = app.getContainer().get('command');
    console.log('✅ 应用启动成功');
    
    // 4. 检查命令是否注册
    const commands = commandManager.list();
    console.log(`📋 已注册命令: ${commands.join(', ')}`);
    
    const hasBrainstormCommand = commands.includes('spec:brainstorm');
    console.log(`🔍 Spec 头脑风暴命令: ${hasBrainstormCommand ? '✅ 已注册' : '❌ 未注册'}`);
    
    if (!hasBrainstormCommand) {
      console.log('❌ 测试失败：命令未注册');
      return;
    }
    
    // 5. 测试命令执行（模拟）
    console.log('\n🧠 测试头脑风暴命令执行...');
    
    const brainstormCommand = commandManager.get('spec:brainstorm');
    if (!brainstormCommand) {
      console.log('❌ 无法获取头脑风暴命令');
      return;
    }
    
    // 6. 验证命令属性
    console.log(`📝 命令名称: ${brainstormCommand.name}`);
    console.log(`📄 命令描述: ${brainstormCommand.description}`);
    console.log(`🏷️  命令别名: ${brainstormCommand.aliases?.join(', ') || '无'}`);
    
    // 7. 测试参数验证
    console.log('\n🔍 测试参数验证...');
    
    const validationTests = [
      { args: [], expected: false, desc: '空参数' },
      { args: ['用户认证系统'], expected: true, desc: '有效主题' },
      { args: ['--interactive'], expected: true, desc: '交互模式' },
      { args: ['-i'], expected: true, desc: '交互模式简写' },
    ];
    
    for (const test of validationTests) {
      const result = brainstormCommand.validate(test.args);
      const status = result === test.expected ? '✅' : '❌';
      console.log(`  ${status} ${test.desc}: ${result}`);
    }
    
    // 8. 检查 SpecManager
    console.log('\n📊 检查 SpecManager...');
    const specManager = app.getContainer().get('spec');
    if (specManager) {
      console.log('✅ SpecManager 已注册');
      
      // 测试创建规格文档
      try {
        const testSpec = await specManager.create({
          title: '测试规格文档',
          description: '这是一个测试规格文档',
          content: '# 测试内容\n\n这是测试内容。',
          tags: ['test'],
          projectPath: process.cwd(),
        });
        
        console.log(`✅ 成功创建测试规格文档: ${testSpec.id}`);
        
        // 清理测试文档
        await specManager.delete(testSpec.id);
        console.log('🧹 已清理测试文档');
        
      } catch (error) {
        console.log(`⚠️  创建测试文档失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log('❌ SpecManager 未注册');
    }
    
    console.log('\n✅ 所有测试完成！');
    console.log('\n💡 使用方式:');
    console.log('  bun ./src/cli.ts');
    console.log('  > /spec:brainstorm "用户认证系统"');
    console.log('  或');
    console.log('  > /spec:brainstorm --interactive');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testSpecBrainstorm().catch(console.error);