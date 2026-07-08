#!/usr/bin/env npx tsx

/**
 * 简化的 Spec 系统测试脚本
 */

console.log('🧪 测试 Spec 系统组件导入');

async function testImports() {
  try {
    // 测试基本导入
    console.log('📋 测试 SpecSystemManager 导入...');
    const { SpecSystemManager } = await import('./src/spec/system/SpecSystemManager.js');
    console.log('✅ SpecSystemManager 导入成功');

    console.log('📋 测试 WorkflowManager 导入...');
    const { WorkflowManager } = await import('./src/spec/system/WorkflowManager.js');
    console.log('✅ WorkflowManager 导入成功');

    console.log('📋 测试 CacheService 导入...');
    const { CacheService } = await import('./src/spec/system/CacheService.js');
    console.log('✅ CacheService 导入成功');

    console.log('📋 测试 SpecCommand 导入...');
    const { SpecCommand } = await import('./src/commands/spec/SpecCommand.js');
    console.log('✅ SpecCommand 导入成功');

    console.log('📋 测试类型定义导入...');
    const types = await import('./src/spec/system/types.js');
    console.log('✅ 类型定义导入成功');

    console.log('\n🎉 所有组件导入测试通过！');
    console.log('✅ 新创建的文件都可以正常使用');
    
  } catch (error) {
    console.error('❌ 导入测试失败:', error);
    process.exit(1);
  }
}

testImports();