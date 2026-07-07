import { Container } from './src/application/Container.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';
import { HelpCommand } from './src/commands/session/HelpCommand.js';
import { ClearCommand } from './src/commands/session/ClearCommand.js';
import { ExitCommand } from './src/commands/session/ExitCommand.js';
import { SessionsCommand } from './src/commands/session/SessionsCommand.js';
import { ModelCommand } from './src/commands/model/ModelCommand.js';

async function testHelpOutput() {
	console.log('🧪 Testing Help Command Output (like)\n');

	// 设置应用
	const container = new Container();
	const commandManager = new SlashCommandManager();

	// 注册一些测试命令
	commandManager.register(new HelpCommand());
	commandManager.register(new ClearCommand());
	commandManager.register(new ExitCommand());
	commandManager.register(new SessionsCommand());
	commandManager.register(new ModelCommand());

	container.register('command', commandManager);

	const helpCommand = new EnhancedHelpCommand();

	console.log('📋 Testing /help (no arguments) - should show all commands:');
	console.log('=' .repeat(60));
	
	// 模拟应用对象
	const mockApp = {
		getContainer: () => container
	};

	// 测试无参数的help命令
	await helpCommand.execute([], mockApp as any);

	console.log('=' .repeat(60));
	console.log('\n📋 Testing /help model - should show specific command help:');
	console.log('=' .repeat(60));
	
	// 测试带参数的help命令
	await helpCommand.execute(['model'], mockApp as any);

	console.log('=' .repeat(60));
	console.log('\n✅ Help Command output test completed!');
}

testHelpOutput().catch(console.error);