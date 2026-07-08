#!/usr/bin/env tsx

/**
 * HTTP 服务器手动测试脚本
 */

import { Application } from './src/application/Application';
import { ConfigService } from './src/services/ConfigService';

async function main() {
	console.log('🧪 Testing HTTP Server Mode\n');

	const configService = new ConfigService();
	await configService.load();

	const app = new Application(undefined, configService);

	try {
		// 启动服务器
		await app.startServer(3000);

		console.log('\n📝 测试步骤：');
		console.log('1. 打开浏览器访问 http://localhost:3000');
		console.log('2. 创建新会话');
		console.log('3. 发送消息测试');
		console.log('4. 检查工具调用');
		console.log('5. 按 Ctrl+C 停止服务器\n');

		// 等待 Ctrl+C
		process.on('SIGINT', async () => {
			console.log('\n\n👋 Stopping server...');
			await app.stopServer();
			process.exit(0);
		});
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	}
}

main();
