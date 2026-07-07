#!/usr/bin/env tsx

/**
 * 测试命令建议系统是否包含 Status 命令
 */

import { SuggestionEngine } from './src/ui/components/SuggestionBox.js';

async function testSuggestionEngine() {
  console.log('🔍 Testing Suggestion Engine...\n');

  const engine = new SuggestionEngine();

  // 1. 测试输入 "/" 时的所有命令
  console.log('📋 Testing "/" input (all commands):');
  const allCommands = await engine.getSuggestions('/');
  console.log(`Found ${allCommands.length} commands:`);
  allCommands.forEach(cmd => {
    console.log(`  ${cmd.text} - ${cmd.description}`);
  });

  // 2. 测试输入 "/s" 时的建议
  console.log('\n🔍 Testing "/s" input:');
  const sCommands = await engine.getSuggestions('/s');
  console.log(`Found ${sCommands.length} commands starting with "/s":`);
  sCommands.forEach(cmd => {
    console.log(`  ${cmd.text} - ${cmd.description}`);
  });

  // 3. 检查是否包含 status 命令
  const hasStatus = sCommands.some(cmd => cmd.text === '/status');
  console.log(`\n✅ Status command found in "/s" suggestions: ${hasStatus ? '✅' : '❌'}`);

  // 4. 测试输入 "/stat" 时的建议
  console.log('\n🔍 Testing "/stat" input:');
  const statCommands = await engine.getSuggestions('/stat');
  console.log(`Found ${statCommands.length} commands starting with "/stat":`);
  statCommands.forEach(cmd => {
    console.log(`  ${cmd.text} - ${cmd.description}`);
  });

  // 5. 测试输入 "/status" 时的建议
  console.log('\n🔍 Testing "/status" input:');
  const statusCommands = await engine.getSuggestions('/status');
  console.log(`Found ${statusCommands.length} commands matching "/status":`);
  statusCommands.forEach(cmd => {
    console.log(`  ${cmd.text} - ${cmd.description}`);
  });

  console.log('\n✅ Suggestion engine tests completed!');
}

// 运行测试
if (import.meta.main) {
  testSuggestionEngine().catch(console.error);
}