import { CommitCommand } from './src/commands/git/CommitCommand';
import { ModelService } from './src/services/ModelService';
import { ConfigManager } from './src/config/ConfigManager';
import { Container } from './src/application/Container';
import { Paths } from './src/services/Paths';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function testCommit() {
	console.log('🧪 Testing Commit Command...\n');

	// 创建容器和服务
	const container = new Container();
	const paths = new Paths({
		productName: 'aicli',
		cwd: process.cwd(),
	});

	// 创建 ConfigManager
	const configManager = new ConfigManager({
		cwd: process.cwd(),
		productName: 'aicli',
	});

	// 创建 ModelService
	const modelService = new ModelService({
		apiKey: process.env.DEEPSEEK_API_KEY || '',
		baseURL: 'https://api.deepseek.com',
		model: 'deepseek-chat',
		container,
		paths,
	});

	const commitCommand = new CommitCommand(modelService, configManager);

	// 测试场景
	console.log('📋 Available test scenarios:');
	console.log('1. Basic commit (no options)');
	console.log('2. Commit with stage (-s)');
	console.log('3. Commit with follow-style (--follow-style)');
	console.log('4. Commit with copy (--copy)');
	console.log('5. Auto commit (-c)');
	console.log('');

	console.log('💡 Usage examples:');
	console.log('  npm run dev test-commit-manual.ts');
	console.log('  /commit');
	console.log('  /commit -s');
	console.log('  /commit --follow-style');
	console.log('  /commit --copy');
	console.log('  /commit -s -c');
	console.log('');

	console.log('⚠️  Note: Make sure you have some git changes before testing!');
	console.log('');

	// 示例：测试基础提交
	console.log('1️⃣  Testing basic commit...');
	try {
		await commitCommand.execute([]);
		console.log('✅ Basic commit test completed');
	} catch (error) {
		console.error('❌ Basic commit test failed:', error);
	}

	console.log('\n✅ All manual tests completed!');
	console.log('\n📝 To test other scenarios, run the command with different options:');
	console.log('  /commit -s          # Stage all changes');
	console.log('  /commit --copy      # Copy to clipboard');
	console.log('  /commit -c          # Auto commit');
}

// 只在直接运行时执行
if (require.main === module) {
	testCommit().catch(console.error);
}

export { testCommit };
