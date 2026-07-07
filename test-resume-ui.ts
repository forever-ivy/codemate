#!/usr/bin/env node

/**
 * Resume命令UI测试
 * 
 * 测试在实际CLI中输入 "/" 时是否显示 /resume 命令
 */

import { SuggestionEngine } from './src/ui/components/SuggestionBox.js';

async function testResumeUI() {
  console.log('🧪 测试Resume命令在UI中的显示...\n');
  
  const engine = new SuggestionEngine();
  
  // 模拟用户输入 "/"
  console.log('📝 模拟用户输入: "/"');
  const suggestions = await engine.getSuggestions('/');
  
  console.log(`\n找到 ${suggestions.length} 个命令:\n`);
  
  // 显示所有命令（模拟UI显示）
  suggestions.forEach((suggestion, index) => {
    const isResume = suggestion.text === '/resume';
    const marker = isResume ? '👉' : '  ';
    console.log(`${marker} ${suggestion.text.padEnd(20)} ${suggestion.description}`);
  });
  
  // 检查 /resume 是否存在
  const resumeCommand = suggestions.find(s => s.text === '/resume');
  
  console.log('\n📊 测试结果:');
  if (resumeCommand) {
    console.log('✅ /resume 命令在列表中找到');
    console.log(`   位置: 第 ${suggestions.findIndex(s => s.text === '/resume') + 1} 个`);
    console.log(`   描述: ${resumeCommand.description}`);
  } else {
    console.log('❌ /resume 命令在列表中未找到');
    console.log('   这意味着用户输入 "/" 时看不到 /resume 命令');
  }
  
  // 测试部分匹配
  console.log('\n📝 测试部分匹配: "/res"');
  const partialSuggestions = await engine.getSuggestions('/res');
  const resumePartial = partialSuggestions.find(s => s.text === '/resume');
  
  if (resumePartial) {
    console.log('✅ 输入 "/res" 可以匹配到 /resume');
  } else {
    console.log('❌ 输入 "/res" 无法匹配到 /resume');
  }
}

testResumeUI().catch(console.error);
