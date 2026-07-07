#!/usr/bin/env tsx

/**
 * MCP 手动测试脚本
 *
 * 使用方法：
 * 1. 创建 mcp.json 配置文件
 * 2. 运行：npx tsx test-mcp-manual.ts
 */

import { MCPManager } from './src/mcp/MCPManager';

async function main() {
	console.log('🧪 Testing MCP Integration\n');

	const mcpManager = new MCPManager();

	try {
		// 初始化
		await mcpManager.initialize('./mcp.json');

		// 列出工具
		const tools = mcpManager.getTools();
		console.log(`\n📋 Available MCP Tools (${tools.length}):`);
		for (const tool of tools) {
			console.log(`  - ${tool.name}: ${tool.description}`);
		}

		// 测试 echo 工具（如果存在）
		const echoTool = tools.find((t) => t.name.includes('echo'));
		if (echoTool) {
			console.log(`\n🧪 Testing ${echoTool.name}...`);
			const result = await echoTool.execute({
				message: 'Hello from manual test!',
			});
			console.log('Result:', result);
		}

		// 测试 add 工具（如果存在）
		const addTool = tools.find((t) => t.name.includes('add'));
		if (addTool) {
			console.log(`\n🧪 Testing ${addTool.name}...`);
			const result = await addTool.execute({
				a: 42,
				b: 58,
			});
			console.log('Result:', result);
		}

		console.log('\n✅ All tests passed!');
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	} finally {
		await mcpManager.disconnect();
	}
}

main();
