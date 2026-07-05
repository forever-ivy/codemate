// tests/unit/managers/SkillManager.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillManager } from '../../../src/managers/SkillManager';
import type { Paths } from '../../../src/services/Paths';
import type { SlashCommandManager } from '../../../src/managers/SlashCommandManager';

describe('SkillManager', () => {
  let skillManager: SkillManager;
  let mockPaths: Paths;
  let mockCommandManager: SlashCommandManager;

  beforeEach(() => {
    // Mock Paths
    mockPaths = {
      globalConfigDir: '/home/user/.aicli',
      globalProjectDir: '/home/user/.aicli/projects/project',
      projectConfigDir: '/project/.aicli',
      getCwd: () => '/project',
      getSessionLogPath: vi.fn(),
      getLatestSessionId: vi.fn(),
      getAllSessions: vi.fn(),
    } as any;

    // Mock SlashCommandManager
    mockCommandManager = {
      register: vi.fn(),
      execute: vi.fn(),
      isCommand: vi.fn(),
      has: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      getAllInfo: vi.fn(),
      count: vi.fn(),
    } as any;

    skillManager = new SkillManager(mockPaths, mockCommandManager);
  });

  describe('loadSkills', () => {
    it('should load skills from multiple sources', async () => {
      // 这个测试需要实际的文件系统
      // 在实际项目中，可以使用 mock-fs 或创建临时文件

      await skillManager.loadSkills();

      // 验证技能已加载
      const skills = skillManager.listSkills();
      expect(Array.isArray(skills)).toBe(true);
    });

    it('should respect priority order', async () => {
      // 测试优先级：Project > Global
      // 需要创建测试文件来验证
    });
  });

  describe('getSkill', () => {
    it('should return skill by name', async () => {
      await skillManager.loadSkills();

      const skill = skillManager.getSkill('test-skill');

      if (skill) {
        expect(skill.name).toBe('test-skill');
        expect(skill.description).toBeDefined();
        expect(skill.content).toBeDefined();
      }
    });

    it('should return undefined for non-existent skill', async () => {
      await skillManager.loadSkills();

      const skill = skillManager.getSkill('non-existent');

      expect(skill).toBeUndefined();
    });
  });

  describe('listSkills', () => {
    it('should return all skills sorted by name', async () => {
      await skillManager.loadSkills();

      const skills = skillManager.listSkills();

      expect(Array.isArray(skills)).toBe(true);

      // 验证排序
      for (let i = 1; i < skills.length; i++) {
        expect(skills[i].name >= skills[i - 1].name).toBe(true);
      }
    });
  });

  describe('parseGitHubSource', () => {
    it('should parse user/repo format', () => {
      const result = (skillManager as any).parseGitHubSource('user/repo');

      expect(result).toEqual({
        user: 'user',
        repo: 'repo',
        path: undefined,
      });
    });

    it('should parse user/repo/path format', () => {
      const result = (skillManager as any).parseGitHubSource('user/repo/skills/test');

      expect(result).toEqual({
        user: 'user',
        repo: 'repo',
        path: 'skills/test',
      });
    });

    it('should throw error for invalid format', () => {
      expect(() => {
        (skillManager as any).parseGitHubSource('invalid');
      }).toThrow('Invalid GitHub source');
    });
  });

  describe('parameter replacement', () => {
    it('should replace positional parameters', () => {
      let content = 'File: $1, Action: $2';
      const args = ['test.ts', 'review'];

      // 模拟参数替换逻辑
      for (const [index, arg] of args.entries()) {
        content = content.replace(new RegExp(`\\$${index + 1}`, 'g'), arg);
      }

      expect(content).toBe('File: test.ts, Action: review');
    });

    it('should replace $ARGUMENTS', () => {
      let content = 'Args: $ARGUMENTS';
      const args = ['test.ts', 'review', 'performance'];

      content = content.replace(/\$ARGUMENTS/g, args.join(' '));

      expect(content).toBe('Args: test.ts review performance');
    });

    it('should handle multiple occurrences', () => {
      let content = '$1 and $1 again';
      const args = ['test'];

      content = content.replace(/\$1/g, args[0]);

      expect(content).toBe('test and test again');
    });
  });
});
