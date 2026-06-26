/**
 * 主题系统
 *
 * 提供统一的颜色、字体、间距管理
 */
import React from 'react';

export interface ColorScheme {
  // 主色调
  primary: string;
  secondary: string;
  accent: string;

  // 语义色彩
  success: string;
  warning: string;
  error: string;
  info: string;

  // 中性色彩
  background: string;
  surface: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    disabled: string;
  };

  // 特殊色彩
  code: string;
  link: string;
  selection: string;
}

export interface Typography {
  fonts: {
    mono: string;
    sans: string;
  };

  sizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };

  weights: {
    normal: string;
    bold: string;
  };
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export class ThemeSystem {
  private currentTheme: 'light' | 'dark' | 'auto' = 'auto';

  // 预定义主题
  private themes = {
    light: {
      colors: {
        primary: '#0066cc',
        secondary: '#6c757d',
        accent: '#17a2b8',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
        info: '#17a2b8',
        background: '#ffffff',
        surface: '#f8f9fa',
        border: '#dee2e6',
        text: {
          primary: '#212529',
          secondary: '#6c757d',
          disabled: '#adb5bd',
        },
        code: '#e83e8c',
        link: '#007bff',
        selection: '#b3d4fc',
      } as ColorScheme,
    },

    dark: {
      colors: {
        primary: '#4dabf7',
        secondary: '#adb5bd',
        accent: '#20c997',
        success: '#51cf66',
        warning: '#ffd43b',
        error: '#ff6b6b',
        info: '#74c0fc',
        background: '#1a1a1a',
        surface: '#2d2d2d',
        border: '#404040',
        text: {
          primary: '#f8f9fa',
          secondary: '#adb5bd',
          disabled: '#6c757d',
        },
        code: '#ff8cc8',
        link: '#74c0fc',
        selection: '#364fc7',
      } as ColorScheme,
    },
  };

  private typography: Typography = {
    fonts: {
      mono: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    sizes: {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
    },
    weights: {
      normal: 'normal',
      bold: 'bold',
    },
  };

  private spacing: Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };

  getCurrentTheme(): ColorScheme {
    if (this.currentTheme === 'auto') {
      // 检测系统主题偏好
      return this.detectSystemTheme();
    }
    return this.themes[this.currentTheme].colors;
  }

  getTypography(): Typography {
    return this.typography;
  }

  getSpacing(): Spacing {
    return this.spacing;
  }

  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    this.currentTheme = theme;
  }

  private detectSystemTheme(): ColorScheme {
    // 简单的系统主题检测
    // 在实际实现中可以检测终端的颜色支持
    return this.themes.dark.colors;
  }
}

// 主题上下文
export const ThemeContext = React.createContext<ThemeSystem | null>(null);

// 主题提供者组件
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeSystem = new ThemeSystem();

  return React.createElement(ThemeContext.Provider, { value: themeSystem }, children);
};

// 主题 Hook
export const useTheme = () => {
  const theme = React.useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
};
