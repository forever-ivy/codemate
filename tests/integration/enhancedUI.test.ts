/**
 * 增强UI集成测试
 */
import { describe, it, expect } from 'vitest';

describe('Enhanced UI Integration', () => {
  it('should handle theme system integration', async () => {
    // 测试主题系统的集成
    const { ThemeSystem } = await import('../../src/ui/theme/ThemeSystem.js');
    const themeSystem = new ThemeSystem();

    // 测试主题切换
    themeSystem.setTheme('light');
    const lightColors = themeSystem.getCurrentTheme();

    themeSystem.setTheme('dark');
    const darkColors = themeSystem.getCurrentTheme();

    // 确保主题切换正常工作
    expect(lightColors.background).not.toBe(darkColors.background);
  });

  it('should handle suggestion engine integration', async () => {
    // 测试建议系统的集成
    const { SuggestionEngine } = await import('../../src/ui/components/SuggestionBox.js');
    const suggestionEngine = new SuggestionEngine();

    const suggestions = await suggestionEngine.getSuggestions('/help');
    expect(suggestions.length).toBeGreaterThan(0);

    // 测试建议选择
    const firstSuggestion = suggestions[0];
    expect(firstSuggestion.text).toBe('/help');
  });

  it('should provide command suggestions', async () => {
    const { SuggestionEngine } = await import('../../src/ui/components/SuggestionBox.js');
    const suggestionEngine = new SuggestionEngine();

    const suggestions = await suggestionEngine.getSuggestions('/');
    const commandSuggestions = suggestions.filter((s) => s.type === 'command');

    expect(commandSuggestions.length).toBeGreaterThan(0);
    expect(commandSuggestions.some((s) => s.text === '/help')).toBe(true);
  });

  it('should handle history suggestions', async () => {
    const { SuggestionEngine } = await import('../../src/ui/components/SuggestionBox.js');
    const suggestionEngine = new SuggestionEngine();

    suggestionEngine.addToHistory('test command');
    const suggestions = await suggestionEngine.getSuggestions('test');

    expect(suggestions.some((s) => s.text === 'test command')).toBe(true);
  });

  it('should provide typography and spacing', async () => {
    const { ThemeSystem } = await import('../../src/ui/theme/ThemeSystem.js');
    const themeSystem = new ThemeSystem();

    const typography = themeSystem.getTypography();
    expect(typography.fonts.mono).toBeDefined();
    expect(typography.sizes.md).toBeGreaterThan(0);

    const spacing = themeSystem.getSpacing();
    expect(spacing.md).toBeGreaterThan(spacing.sm);
  });
});
