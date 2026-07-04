import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewCommand } from '../../../src/commands/review/ReviewCommand.js';
import type { Application } from '../../../src/application/Application.js';
import type { Container } from '../../../src/application/Container.js';
import type { ModelService } from '../../../src/services/ModelService.js';

describe('ReviewCommand', () => {
  let command: ReviewCommand;
  let mockApp: Application;
  let mockContainer: Container;
  let mockModelService: ModelService;

  beforeEach(() => {
    mockModelService = {
      generateText: vi.fn(),
    } as any;

    mockContainer = {
      get: vi.fn((name: string) => {
        if (name === 'model') return mockModelService;
        return {};
      }),
    } as any;

    mockApp = {
      getContainer: vi.fn(() => mockContainer),
    } as any;

    command = new ReviewCommand();
  });

  describe('basic properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('review');
      expect(command.description).toBe('AI-powered code review');
      expect(command.aliases).toEqual(['r']);
    });
  });

  describe('parseOptions', () => {
    it('should parse basic file target', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      const options = parseOptions(['src/test.js']);

      expect(options.target).toBe('src/test.js');
      expect(options.type).toBe('directory'); // 默认类型，因为文件不存在
    });

    it('should parse diff option', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      // Mock execSync to avoid actual git calls
      vi.doMock('child_process', () => ({
        execSync: vi.fn(() => 'mock diff content'),
      }));

      const options = parseOptions(['--diff']);

      expect(options.type).toBe('diff');
    });

    it('should parse security option', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      const options = parseOptions(['--security', 'src/']);

      expect(options.categories).toEqual(['security']);
      expect(options.target).toBe('src/');
    });

    it('should parse performance option', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      const options = parseOptions(['--performance']);

      expect(options.categories).toEqual(['performance']);
    });

    it('should parse format option', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      const options = parseOptions(['--format', 'json']);

      expect(options.outputFormat).toBe('json');
    });

    it('should parse include and exclude patterns', () => {
      const parseOptions = (command as any).parseOptions.bind(command);

      const options = parseOptions(['--include', '*.ts,*.js', '--exclude', 'node_modules,dist']);

      expect(options.includePatterns).toEqual(['*.ts', '*.js']);
      expect(options.excludePatterns).toEqual(['node_modules', 'dist']);
    });
  });

  describe('execute', () => {
    it('should show help when requested', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await command.execute(['help'], mockApp);

      expect(consoleSpy).toHaveBeenCalledWith('🔍 Review 命令使用说明');

      consoleSpy.mockRestore();
    });

    it('should handle execution errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock container to throw error
      vi.mocked(mockContainer.get).mockImplementation(() => {
        throw new Error('Service not found');
      });

      await command.execute(['test.js'], mockApp);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ 代码审查失败:', 'Service not found');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('helper methods', () => {
    it('should get correct severity weight', () => {
      const getSeverityWeight = (command as any).getSeverityWeight.bind(command);

      expect(getSeverityWeight('critical')).toBe(4);
      expect(getSeverityWeight('error')).toBe(3);
      expect(getSeverityWeight('warning')).toBe(2);
      expect(getSeverityWeight('info')).toBe(1);
      expect(getSeverityWeight('unknown')).toBe(0);
    });

    it('should get correct severity icons', () => {
      const getSeverityIcon = (command as any).getSeverityIcon.bind(command);

      expect(getSeverityIcon('critical')).toBe('🚨');
      expect(getSeverityIcon('error')).toBe('❌');
      expect(getSeverityIcon('warning')).toBe('⚠️');
      expect(getSeverityIcon('info')).toBe('ℹ️');
      expect(getSeverityIcon('unknown')).toBe('❓');
    });

    it('should get correct category icons', () => {
      const getCategoryIcon = (command as any).getCategoryIcon.bind(command);

      expect(getCategoryIcon('security')).toBe('🔒');
      expect(getCategoryIcon('performance')).toBe('⚡');
      expect(getCategoryIcon('maintainability')).toBe('🔧');
      expect(getCategoryIcon('reliability')).toBe('🛡️');
      expect(getCategoryIcon('style')).toBe('🎨');
      expect(getCategoryIcon('best-practice')).toBe('✨');
      expect(getCategoryIcon('bug')).toBe('🐛');
      expect(getCategoryIcon('complexity')).toBe('🧩');
      expect(getCategoryIcon('unknown')).toBe('📋');
    });
  });
});
