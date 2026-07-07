#!/usr/bin/env tsx

/**
 * Resume命令自动完成功能测试
 * 
 * 测试场景：
 * 1. 输入 "/" 时应该显示所有命令，包括 /resume
 * 2. 输入 "/res" 时应该显示 /resume 命令
 * 3. 验证 /resume 命令的描述正确显示
 */

import { SuggestionEngine } from './src/ui/components/SuggestionBox';

async function testResumeAutocomplete() {
  console.log('🧪 测试Resume命令自动完成功能...\n');
  
  const engine = new SuggestionEngine();
  
  // 测试1: 输入 "/" 应该显示所有命令
  console.log('📝 测试1: 输入 "/" 显示所有命令');
  const allCommands = await engine.getSuggestions('/');
  const resumeInAll = allCommands.find(cmd => cmd.text === '/resume');
  
  if (resumeInAll) {
    console.log('✅ /resume 命令在完整列表中找到');
    console.log(`   描述: ${resumeInAll.description}`);
  } else {
    console.log('❌ /resume 命令在完整列表中未找到');
    console.log('   可用命令:', allCommands.map(cmd => cmd.text).join(', '));
  }
  
  // 测试2: 输入 "/res" 应该匹配 /resume
  console.log('\n📝 测试2: 输入 "/res" 匹配 /resume');
  const partialMatch = await engine.getSuggestions('/res');
  const resumeMatch = partialMatch.find(cmd => cmd.text === '/resume');
  
  if (resumeMatch) {
    console.log('✅ /resume 命令通过部分匹配找到');
    console.log(`   描述: ${resumeMatch.description}`);
  } else {
    console.log('❌ /resume 命令通过部分匹配未找到');
    console.log('   匹配结果:', partialMatch.map(cmd => cmd.text).join(', '));
  }
  
  // 测试3: 输入 "/resume" 应该精确匹配
  console.log('\n📝 测试3: 输入 "/resume" 精确匹配');
  const exactMatch = await engine.getSuggestions('/resume');
  const resumeExact = exactMatch.find(cmd => cmd.text === '/resume');
  
  if (resumeExact) {
    console.log('✅ /resume 命令精确匹配成功');
    console.log(`   描述: ${resumeExact.description}`);
  } else {
    console.log('❌ /resume 命令精确匹配失败');
    console.log('   匹配结果:', exactMatch.map(cmd => cmd.text).join(', '));
  }
  
  // 测试4: 验证命令总数
  console.log('\n📝 测试4: 验证命令总数');
  console.log(`总命令数: ${allCommands.length}`);
  console.log('所有命令:', allCommands.map(cmd => cmd.text).sort().join(', '));
  
  // 汇总结果
  const allTests = [resumeInAll, resumeMatch, resumeExact];
  const passedTests = allTests.filter(Boolean).length;
  
  console.log('\n📊 测试结果汇总:');
  console.log(`✅ 通过: ${passedTests}/3`);
  console.log(`❌ 失败: ${3 - passedTests}/3`);
  
  if (passedTests === 3) {
    console.log('\n🎉 所有测试通过！Resume命令自动完成功能正常工作');
  } else {
    console.log('\n⚠️  部分测试失败，需要进一步检查');
  }
}

// 运行测试
testResumeAutocomplete().catch(console.error);