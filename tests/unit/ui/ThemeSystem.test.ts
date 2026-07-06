/**
 * 主题系统单元测试
 */
import { describe, it, expect } from 'vitest';
import { ThemeSystem } from '../../../src/ui/theme/ThemeSystem.js';

describe('ThemeSystem', () => {
  it('should provide default theme', () => {
    const themeSystem = new ThemeSystem();
    const theme = themeSystem.getCurrentTheme();

    expect(theme).toBeDefined();
    expect(theme.primary).toBeDefined();
    expect(theme.background).toBeDefined();
    expect(theme.text).toBeDefined();
    expect(theme.text.primary).toBeDefined();
  });

  it('should switch themes', () => {
    const themeSystem = new ThemeSystem();

    themeSystem.setTheme('light');
    const lightTheme = themeSystem.getCurrentTheme();

    themeSystem.setTheme('dark');
    const darkTheme = themeSystem.getCurrentTheme();

    expect(lightTheme.background).not.toBe(darkTheme.background);
    expect(lightTheme.text.primary).not.toBe(darkTheme.text.primary);
  });

  it('should provide typography settings', () => {
    const themeSystem = new ThemeSystem();
    const typography = themeSystem.getTypography();

    expect(typography.fonts.mono).toBeDefined();
    expect(typography.fonts.sans).toBeDefined();
    expect(typography.sizes.md).toBeGreaterThan(0);
    expect(typography.weights.normal).toBeDefined();
  });

  it('should provide spacing settings', () => {
    const themeSystem = new ThemeSystem();
    const spacing = themeSystem.getSpacing();

    expect(spacing.xs).toBeGreaterThan(0);
    expect(spacing.sm).toBeGreaterThan(spacing.xs);
    expect(spacing.md).toBeGreaterThan(spacing.sm);
    expect(spacing.lg).toBeGreaterThan(spacing.md);
    expect(spacing.xl).toBeGreaterThan(spacing.lg);
  });

  it('should handle auto theme detection', () => {
    const themeSystem = new ThemeSystem();

    themeSystem.setTheme('auto');
    const autoTheme = themeSystem.getCurrentTheme();

    // 应该返回一个有效的主题
    expect(autoTheme).toBeDefined();
    expect(autoTheme.primary).toBeDefined();
  });
});
