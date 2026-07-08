#!/usr/bin/env tsx

/**
 * 手动测试脚本 - 配置系统增强
 *
 * 测试第 26 章的配置系统功能
 */

import { ConfigManager } from './src/config/ConfigManager';
import { ConfigService } from './src/services/ConfigService';
import * as path from 'pathe';

console.log('🧪 测试配置系统增强\n');

// 测试 1：ConfigManager 基本功能
console.log('=== 测试 1：ConfigManager 基本功能 ===\n');

const configManager = new ConfigManager({
  cwd: process.cwd(),
  productName: 'test-codemate',
  argvConfig: {},
});

console.log('1. 默认配置：');
console.log(`   model: ${configManager.config.model}`);
console.log(`   language: ${configManager.config.language}`);
console.log(`   approvalMode: ${configManager.config.approvalMode}\n`);

// 测试 2：设置平面配置
console.log('=== 测试 2：设置平面配置 ===\n');

configManager.setConfig(false, 'model', 'claude-sonnet-4');
console.log(`2. 设置后的 model: ${configManager.config.model}\n`);

// 测试 3：设置嵌套配置
console.log('=== 测试 3：设置嵌套配置 ===\n');

configManager.setConfig(false, 'agent.Explore.model', 'claude-haiku');
configManager.setConfig(false, 'agent.Plan.model', 'claude-sonnet');
console.log('3. 嵌套配置：');
console.log(`   agent.Explore.model: ${configManager.config.agent?.Explore?.model}`);
console.log(`   agent.Plan.model: ${configManager.config.agent?.Plan?.model}\n`);

// 测试 4：获取配置
console.log('=== 测试 4：获取配置 ===\n');

const model = configManager.getConfig(false, 'model');
const exploreModel = configManager.getConfig(false, 'agent.Explore.model');
console.log('4. 获取配置：');
console.log(`   model: ${model}`);
console.log(`   agent.Explore.model: ${exploreModel}\n`);

// 测试 5：添加数组配置
console.log('=== 测试 5：添加数组配置 ===\n');

configManager.addConfig(false, 'plugins', ['logger-plugin']);
configManager.addConfig(false, 'plugins', ['performance-plugin']);
console.log('5. 插件列表：');
console.log(`   plugins: ${JSON.stringify(configManager.config.plugins)}\n`);

// 测试 6：移除数组配置
console.log('=== 测试 6：移除数组配置 ===\n');

configManager.removeConfig(false, 'plugins', ['logger-plugin']);
console.log('6. 移除后的插件列表：');
console.log(`   plugins: ${JSON.stringify(configManager.config.plugins)}\n`);

// 测试 7：ConfigService 集成
console.log('=== 测试 7：ConfigService 集成 ===\n');

const configService = new ConfigService({
  cwd: process.cwd(),
  productName: 'test-codemate',
  argvConfig: {},
});

console.log('7. ConfigService 初始化成功');
const enhancedConfig = configService.getEnhancedConfig();
if (enhancedConfig) {
  console.log(`   model: ${enhancedConfig.model}`);
  console.log(`   language: ${enhancedConfig.language}\n`);
}

// 测试 8：深度合并
console.log('=== 测试 8：深度合并 ===\n');

configManager.setConfig(false, 'commit.language', 'zh-CN');
configManager.setConfig(false, 'commit.model', 'deepseek-chat');
console.log('8. 提交配置：');
console.log(`   commit.language: ${configManager.config.commit?.language}`);
console.log(`   commit.model: ${configManager.config.commit?.model}\n`);

// 测试 9：配置优先级
console.log('=== 测试 9：配置优先级 ===\n');

configManager.setConfig(true, 'temperature', 0.5);  // 全局配置
configManager.setConfig(false, 'temperature', 0.9); // 项目配置
console.log('9. 配置优先级（项目配置应覆盖全局配置）：');
console.log(`   temperature: ${configManager.config.temperature}\n`);

// 测试 10：完整配置输出
console.log('=== 测试 10：完整配置输出 ===\n');

console.log('10. 完整配置（部分）：');
console.log(JSON.stringify({
  model: configManager.config.model,
  planModel: configManager.config.planModel,
  language: configManager.config.language,
  quiet: configManager.config.quiet,
  approvalMode: configManager.config.approvalMode,
  plugins: configManager.config.plugins,
  agent: configManager.config.agent,
  commit: configManager.config.commit,
  temperature: configManager.config.temperature,
}, null, 2));

console.log('\n✅ 所有测试完成！');
console.log('\n提示：配置文件已保存到：');
console.log(`  - 全局配置：~/.test-codemate/config.json`);
console.log(`  - 项目配置：.test-codemate/config.json`);
