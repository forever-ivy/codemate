// test-skills-manual.ts

import { SkillManager } from './src/managers/SkillManager';
import { SlashCommandManager } from './src/managers/SlashCommandManager';
import { Paths } from './src/services/Paths';

async function testSkills() {
	console.log('=== Skills System Manual Test ===\n');

	// 初始化
	const paths = new Paths({
		productName: 'aicli',
		cwd: process.cwd(),
	});
	const commandManager = new SlashCommandManager();
	const skillManager = new SkillManager(paths, commandManager);

	// 测试1：加载技能
	console.log('Test 1: Load skills');
	await skillManager.loadSkills();
	console.log('✓ Skills loaded\n');

	// 测试2：列出技能
	console.log('Test 2: List skills');
	const skills = skillManager.listSkills();
	console.log(`Found ${skills.length} skills:`);
	for (const skill of skills) {
		console.log(`  - ${skill.name}: ${skill.description} (${skill.source})`);
	}
	console.log();

	// 测试3：获取特定技能
	console.log('Test 3: Get specific skill');
	if (skills.length > 0) {
		const firstSkill = skills[0];
		const skill = skillManager.getSkill(firstSkill.name);
		console.log(`Skill: ${skill?.name}`);
		console.log(`Description: ${skill?.description}`);
		console.log(`Content preview: ${skill?.content.substring(0, 100)}...`);
	} else {
		console.log('No skills available for testing');
	}
	console.log();

	// 测试4：参数替换
	console.log('Test 4: Parameter replacement');
	const testContent = 'File: $1, Action: $2, All: $ARGUMENTS';
	const args = ['test.ts', 'review', 'performance'];

	let result = testContent;
	for (const [index, arg] of args.entries()) {
		result = result.replace(new RegExp(`\\$${index + 1}`, 'g'), arg);
	}
	result = result.replace(/\$ARGUMENTS/g, args.join(' '));

	console.log(`Original: ${testContent}`);
	console.log(`Args: ${args.join(', ')}`);
	console.log(`Result: ${result}`);
	console.log();

	console.log('=== All tests completed ===');
}

testSkills().catch(console.error);
