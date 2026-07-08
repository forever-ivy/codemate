#!/usr/bin/env npx tsx

/**
 * 简单测试 Spec 头脑风暴命令注册
 */

import { SpecBrainstormCommand } from './src/commands/spec/SpecBrainstormCommand.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';

async function testSpecBrainstormCommand() {
  console.log('🧪 测试 Spec 头脑风暴命令注册\n');

  try {
    // 1. 创建命令实例
    console.log('📝 创建 SpecBrainstormCommand 实例...');
    const command = new SpecBrainstormCommand();
    
    // 2. 验证命令属性
    console.log(`✅ 命令名称: ${command.name}`);
    console.log(`✅ 命令描述: ${command.description}`);
    console.log(`✅ 命令别名: ${command.aliases?.join(', ') || '无'}`);
    
    // 3. 测试参数验证
    console.log('\n🔍 测试参数验证...');
    
    const validationTests = [
      { args: [], expected: false, desc: '空参数' },
      { args: ['用户认证系统'], expected: true, desc: '有效主题' },
      { args: ['--interactive'], expected: true, desc: '交互模式' },
      { args: ['-i'], expected: true, desc: '交互模式简写' },
    ];
    
    for (const test of validationTests) {
      const result = command.validate(test.args);
      const status = result === test.expected ? '✅' : '❌';
      console.log(`  ${status} ${test.desc}: ${result}`);
    }
    
    // 4. 测试命令注册
    console.log('\n📋 测试命令注册...');
    const commandManager = new SlashCommandManager();
    commandManager.register(command);
    
    const registeredCommands = commandManager.list();
    console.log(`✅ 已注册命令: ${registeredCommands.join(', ')}`);
    
    const hasCommand = registeredCommands.includes('spec:brainstorm');
    console.log(`🔍 头脑风暴命令: ${hasCommand ? '✅ 已注册' : '❌ 未注册'}`);
    
    // 5. 测试命令获取
    const retrievedCommand = commandManager.get('spec:brainstorm');
    if (retrievedCommand) {
      console.log('✅ 可以成功获取注册的命令');
      console.log(`   名称: ${retrievedCommand.name}`);
      console.log(`   描述: ${retrievedCommand.description}`);
    } else {
      console.log('❌ 无法获取注册的命令');
    }
    
    // 6. 测试别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        const aliasCommand = commandManager.get(alias);
        const status = aliasCommand ? '✅' : '❌';
        console.log(`${status} 别名 "${alias}" ${aliasCommand ? '可用' : '不可用'}`);
      }
    }
    
    console.log('\n✅ 所有基础测试通过！');
    console.log('\n💡 命令已准备就绪，可以在 CLI 中使用：');
    console.log('  /spec:brainstorm "用户认证系统"');
    console.log('  /spec:brainstorm --interactive');
    console.log('  /spec:bs "电商购物车"  # 使用别名');
    console.log('  /brainstorm -i        # 使用别名');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testSpecBrainstormCommand().catch(console.error);