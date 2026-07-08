import { Container } from './src/application/Container.js';
import { Application } from './src/application/Application.js';
import { SlashCommandManager } from './src/managers/SlashCommandManager.js';
import { EnhancedHelpCommand } from './src/commands/session/EnhancedHelpCommand.js';
import { HelpCommand } from './src/commands/session/HelpCommand.js';
import { ClearCommand } from './src/commands/session/ClearCommand.js';
import { ExitCommand } from './src/commands/session/ExitCommand.js';
import { SessionsCommand } from './src/commands/session/SessionsCommand.js';
import { ModelCommand } from './src/commands/model/ModelCommand.js';

async function testEnhancedHelp() {
	console.log('🧪 Testing Enhanced Help Command\n');

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

	const app = new Application(container);
	const helpCommand = new EnhancedHelpCommand();

	// 设置commandManager
	(helpCommand as any).commandManager = commandManager;

	// 测试元数据
	console.log('📋 Metadata:');
	const metadata = helpCommand.getMetadata();
	console.log(`  Title: ${metadata.title}`);
	console.log(`  Description: ${metadata.description}`);
	console.log(`  Category: ${metadata.category}`);
	console.log(`  Icon: ${metadata.icon}`);
	console.log(`  Color: ${metadata.color}\n`);

	// 测试数据获取
	console.log('📊 Fetching command data...');
	const data = await helpCommand.fetchData();
	console.log(`  Found ${data.length} commands\n`);

	// 显示所有命令
	console.log('📚 All commands:');
	data.forEach((cmd) => {
		console.log(`\n  /${cmd.name}`);
		if (cmd.aliases.length > 0) {
			console.log(`    Aliases: ${cmd.aliases.map((a) => `/${a}`).join(', ')}`);
		}
		console.log(`    Description: ${cmd.description}`);
		console.log(`    Category: ${cmd.category}`);
		console.log(`    Usage: ${cmd.usage}`);
		if (cmd.examples.length > 0) {
			console.log(`    Examples:`);
			cmd.examples.forEach((ex) => console.log(`      ${ex}`));
		}
		if (cmd.usageCount > 0) {
			console.log(`    Used: ${cmd.usageCount} times`);
		}
		if (cmd.tags.length > 0) {
			console.log(`    Tags: ${cmd.tags.join(', ')}`);
		}
	});

	// 测试分类
	console.log('\n\n📂 Commands by category:');
	const categories = new Map<string, typeof data>();
	data.forEach((cmd) => {
		if (!categories.has(cmd.category)) {
			categories.set(cmd.category, []);
		}
		categories.get(cmd.category)?.push(cmd);
	});

	categories.forEach((commands, category) => {
		console.log(`\n  ${category}:`);
		commands.forEach((cmd) => {
			console.log(`    /${cmd.name} - ${cmd.description}`);
		});
	});

	// 测试快捷键
	console.log('\n\n⌨️  Keyboard shortcuts:');
	const shortcuts = helpCommand.getKeyboardShortcuts();
	const shortcutsByCategory = new Map<string, typeof shortcuts>();
	shortcuts.forEach((shortcut) => {
		const cat = shortcut.category || 'General';
		if (!shortcutsByCategory.has(cat)) {
			shortcutsByCategory.set(cat, []);
		}
		shortcutsByCategory.get(cat)?.push(shortcut);
	});

	shortcutsByCategory.forEach((shortcuts, category) => {
		console.log(`\n  ${category}:`);
		shortcuts.forEach((shortcut) => {
			console.log(`    ${shortcut.key.padEnd(10)} - ${shortcut.description}`);
		});
	});

	// 测试搜索
	console.log('\n\n🔍 Testing search:');
	const searchQuery = 'help';
	console.log(`  Searching for: "${searchQuery}"`);
	const searchResults = data.filter((cmd) => {
		const searchText = (helpCommand as any).getSearchableText(cmd);
		return searchText.toLowerCase().includes(searchQuery.toLowerCase());
	});
	console.log(`  Found ${searchResults.length} results:`);
	searchResults.forEach((cmd) => {
		console.log(`    /${cmd.name} - ${cmd.description}`);
	});

	// 测试过滤
	console.log('\n\n🔽 Testing filters:');
	console.log('  Filter by category "Basic":');
	const basicCommands = (helpCommand as any).applyCustomFilters(data, {
		category: 'Basic',
	});
	console.log(`  Found ${basicCommands.length} commands:`);
	basicCommands.forEach((cmd: any) => {
		console.log(`    /${cmd.name}`);
	});

	// 测试排序
	console.log('\n\n📊 Testing sorting:');
	console.log('  Sort by usage count (descending):');
	const sortedByUsage = [...data].sort((a, b) => b.usageCount - a.usageCount);
	sortedByUsage.slice(0, 5).forEach((cmd) => {
		console.log(`    /${cmd.name} - ${cmd.usageCount} uses`);
	});

	console.log('\n✅ Enhanced Help Command test completed!');
}

testEnhancedHelp().catch(console.error);
