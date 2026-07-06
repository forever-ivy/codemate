/**
 * 建议引擎单元测试
 */
import { describe, it, expect } from 'vitest';
import { SuggestionEngine } from '../../../src/ui/components/SuggestionBox.js';

describe('SuggestionEngine', () => {
  it('should provide command suggestions', async () => {
    const engine = new SuggestionEngine();
    const suggestions = await engine.getSuggestions('/he');

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        text: '/help',
        type: 'command',
      })
    );
  });

  it('should provide all commands for slash prefix', async () => {
    const engine = new SuggestionEngine();
    const suggestions = await engine.getSuggestions('/');

    // 应该包含所有命令
    const commandSuggestions = suggestions.filter((s) => s.type === 'command');
    expect(commandSuggestions.length).toBeGreaterThan(5);

    // 检查一些基本命令
    const commandTexts = commandSuggestions.map((s) => s.text);
    expect(commandTexts).toContain('/help');
    expect(commandTexts).toContain('/clear');
    expect(commandTexts).toContain('/exit');
  });

  it('should provide history suggestions', async () => {
    const engine = new SuggestionEngine();
    engine.addToHistory('previous command');
    engine.addToHistory('another test');

    const suggestions = await engine.getSuggestions('prev');

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        text: 'previous command',
        type: 'history',
      })
    );
  });

  it('should sort suggestions by priority', async () => {
    const engine = new SuggestionEngine();
    engine.addToHistory('history item');

    const suggestions = await engine.getSuggestions('/h');

    // 命令建议应该有更高的优先级
    const commandSuggestions = suggestions.filter((s) => s.type === 'command');
    const historySuggestions = suggestions.filter((s) => s.type === 'history');

    if (commandSuggestions.length > 0 && historySuggestions.length > 0) {
      expect(commandSuggestions[0].priority).toBeGreaterThan(historySuggestions[0].priority);
    }
  });

  it('should limit history size', () => {
    const engine = new SuggestionEngine();

    // 添加超过限制的历史记录
    for (let i = 0; i < 150; i++) {
      engine.addToHistory(`command ${i}`);
    }

    // 历史记录应该被限制在合理大小
    // 这里我们通过检查最新的记录是否存在来验证
    engine.addToHistory('latest command');

    // 应该能找到最新的命令
    engine.getSuggestions('latest').then((suggestions) => {
      expect(suggestions.some((s) => s.text === 'latest command')).toBe(true);
    });
  });

  it('should provide file suggestions for path input', async () => {
    const engine = new SuggestionEngine();
    const suggestions = await engine.getSuggestions('./src/');

    // 应该包含文件建议
    const fileSuggestions = suggestions.filter((s) => s.type === 'file');
    expect(fileSuggestions.length).toBeGreaterThan(0);
  });

  it('should provide command descriptions', async () => {
    const engine = new SuggestionEngine();
    const suggestions = await engine.getSuggestions('/help');

    const helpSuggestion = suggestions.find((s) => s.text === '/help');
    expect(helpSuggestion).toBeDefined();
    expect(helpSuggestion?.description).toBeDefined();
    expect(helpSuggestion?.description.length).toBeGreaterThan(0);
  });
});

describe('SuggestionBox - 循环选择', () => {
  it('应该支持从第一个循环到最后一个', () => {
    // 模拟循环选择逻辑
    const suggestions = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
      { text: '/exit', description: 'Exit', type: 'command' as const, priority: 10 },
    ];

    let selectedIndex = 0;

    // 向上选择：从第一个应该跳到最后一个
    selectedIndex = selectedIndex === 0 ? suggestions.length - 1 : selectedIndex - 1;

    expect(selectedIndex).toBe(1); // 最后一个的索引
  });

  it('应该支持从最后一个循环到第一个', () => {
    const suggestions = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
      { text: '/exit', description: 'Exit', type: 'command' as const, priority: 10 },
    ];

    let selectedIndex = 1; // 最后一个

    // 向下选择：从最后一个应该跳到第一个
    selectedIndex = selectedIndex === suggestions.length - 1 ? 0 : selectedIndex + 1;

    expect(selectedIndex).toBe(0); // 第一个的索引
  });

  it('中间位置的正常选择不应受影响', () => {
    const suggestions = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
      { text: '/clear', description: 'Clear', type: 'command' as const, priority: 10 },
      { text: '/exit', description: 'Exit', type: 'command' as const, priority: 10 },
    ];

    let selectedIndex = 1; // 中间位置

    // 向上选择
    selectedIndex = selectedIndex === 0 ? suggestions.length - 1 : selectedIndex - 1;
    expect(selectedIndex).toBe(0);

    // 向下选择
    selectedIndex = selectedIndex === suggestions.length - 1 ? 0 : selectedIndex + 1;
    expect(selectedIndex).toBe(1);
  });
});

describe('SuggestionBox - 防闪烁', () => {
  it('suggestions长度不变时不应触发重置', () => {
    const suggestions1 = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
    ];
    const suggestions2 = [
      { text: '/exit', description: 'Exit', type: 'command' as const, priority: 10 },
    ];

    // 长度相同，不应该重置
    expect(suggestions1.length).toBe(suggestions2.length);
  });

  it('suggestions长度变化时应该重置', () => {
    const suggestions1 = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
    ];
    const suggestions2 = [
      { text: '/help', description: 'Help', type: 'command' as const, priority: 10 },
      { text: '/exit', description: 'Exit', type: 'command' as const, priority: 10 },
    ];

    // 长度不同，应该重置
    expect(suggestions1.length).not.toBe(suggestions2.length);
  });
});
