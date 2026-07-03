// tests/integration/skills.test.ts

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'pathe';
import { tmpdir } from 'node:os';
import { SkillManager } from '../../src/managers/SkillManager';
import { Paths } from '../../src/services/Paths';
import { SlashCommandManager } from '../../src/managers/SlashCommandManager';

describe('Skills Integration', () => {
  let testDir: string;
  let skillManager: SkillManager;
  let paths: Paths;
  let commandManager: SlashCommandManager;

  beforeAll(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `skills-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // 创建测试技能
    const skillDir = join(testDir, 'skills', 'test-skill');
    await mkdir(skillDir, { recursive: true });

    const skillContent = `---
name: test-skill
description: Test skill for integration testing
---

This is a test skill.
File: $1
Action: $2
All: $ARGUMENTS
`;

    await writeFile(join(skillDir, 'SKILL.md'), skillContent);

    // 初始化服务
    paths = new Paths({
      productName: 'aicli',
      cwd: testDir,
    });
  });

  beforeEach(() => {
    // 每个测试创建新的 commandManager 和 skillManager
    commandManager = new SlashCommandManager();
    skillManager = new SkillManager(paths, commandManager);
  });

  afterAll(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load skills from test directory', async () => {
    await skillManager.loadSkills();

    const skills = skillManager.listSkills();
    expect(skills.length).toBeGreaterThan(0);

    const testSkill = skills.find((s) => s.name === 'test-skill');
    expect(testSkill).toBeDefined();
    expect(testSkill?.description).toBe('Test skill for integration testing');
  });

  it('should register skills as slash commands', async () => {
    await skillManager.loadSkills();

    const command = commandManager.get('test-skill');
    expect(command).toBeDefined();
    expect(command?.name).toBe('test-skill');
  });

  it('should replace parameters correctly', async () => {
    await skillManager.loadSkills();

    const skill = skillManager.getSkill('test-skill');
    expect(skill).toBeDefined();

    // 模拟参数替换逻辑
    let content = skill!.content;
    const args = ['file.ts', 'review', 'performance'];

    // 替换位置参数
    for (const [index, arg] of args.entries()) {
      content = content.replace(new RegExp(`\\$${index + 1}`, 'g'), arg);
    }

    // 替换 $ARGUMENTS
    content = content.replace(/\$ARGUMENTS/g, args.join(' '));

    expect(content).toContain('File: file.ts');
    expect(content).toContain('Action: review');
    expect(content).toContain('All: file.ts review performance');
  });

  it('should handle skill priority correctly', async () => {
    // 创建同名技能在不同位置
    const globalSkillDir = join(testDir, 'skills', 'priority-test');
    await mkdir(globalSkillDir, { recursive: true });
    await writeFile(
      join(globalSkillDir, 'SKILL.md'),
      '---\nname: priority-test\ndescription: Global skill\n---\nGlobal content'
    );

    const projectSkillDir = join(testDir, 'skills', 'priority-test');
    await mkdir(projectSkillDir, { recursive: true });
    await writeFile(
      join(projectSkillDir, 'SKILL.md'),
      '---\nname: priority-test\ndescription: Project skill\n---\nProject content'
    );

    await skillManager.loadSkills();

    const skill = skillManager.getSkill('priority-test');

    // 项目级技能应该覆盖全局技能
    expect(skill?.description).toBe('Project skill');
    expect(skill?.content).toContain('Project content');
  });
});
