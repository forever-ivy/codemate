/**
 * 增强输入系统
 *
 * 支持智能提示、快捷键和多种输入模式
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { SuggestionBox, SuggestionEngine } from './SuggestionBox.js';
import { StatusIndicator } from './StatusIndicator.js';
import { useTheme } from '../theme/ThemeSystem.js';

interface EnhancedInputProps {
  onSubmit: (value: string) => void;
  onCommandUI?: (command: string, data: any) => void;
  placeholder?: string;
  disabled?: boolean;
  showSuggestions?: boolean;
  showStatus?: boolean;
  status?: 'idle' | 'thinking' | 'streaming' | 'error';
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  onSubmit,
  placeholder = 'Type your message...',
  disabled = false,
  showSuggestions = true,
  showStatus = true,
  status = 'idle',
}) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [inputMode, setInputMode] = useState<'normal' | 'command' | 'search'>('normal');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const theme = useTheme();
  const colors = theme.getCurrentTheme();
  const suggestionEngine = useRef(new SuggestionEngine());

  // 获取建议
  useEffect(() => {
    if (showSuggestions && input.length > 0) {
      const getSuggestions = async () => {
        const newSuggestions = await suggestionEngine.current.getSuggestions(input);
        setSuggestions(newSuggestions);
        setShowSuggestionBox(newSuggestions.length > 0);
      };

      // 防抖
      const timer = setTimeout(getSuggestions, 200);
      return () => clearTimeout(timer);
    } else {
      setShowSuggestionBox(false);
      return undefined;
    }
  }, [input, showSuggestions]);

  // 检测输入模式
  useEffect(() => {
    if (input.startsWith('/')) {
      setInputMode('command');
    } else if (input.startsWith('?')) {
      setInputMode('search');
    } else {
      setInputMode('normal');
    }
  }, [input]);

  const handleSubmit = (value: string) => {
    if (!value.trim() || disabled) return;

    // 添加到历史记录
    setHistory((prev) => [value, ...prev.slice(0, 49)]); // 保持50条历史
    suggestionEngine.current.addToHistory(value);

    // 立即清空输入状态
    setInput('');
    setHistoryIndex(-1);
    setShowSuggestionBox(false);

    // 然后提交（这样onSubmit回调执行时输入已经清空了）
    onSubmit(value);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    setInput(suggestion.text);
    setShowSuggestionBox(false);
  };

  const handleSuggestionCancel = () => {
    setShowSuggestionBox(false);
  };

  // 判断是否显示完整命令列表
  const shouldShowFullCommandList = input === '/' && suggestions.length > 5;

  // 自定义键盘处理
  useInput((input, key) => {
    if (disabled) return;

    // 如果建议框可见，不处理历史记录导航
    if (showSuggestionBox) {
      return;
    }

    // 历史记录导航
    if (key.upArrow) {
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }

    // 快捷键
    if (key.ctrl) {
      switch (input) {
        case 'l':
          // Ctrl+L: 清屏
          // 这里可以触发清屏事件
          break;
        case 'r':
          // Ctrl+R: 搜索历史
          setInputMode('search');
          break;
        case 'c':
          // Ctrl+C: 取消当前操作
          setInput('');
          setShowSuggestionBox(false);
          break;
      }
    }

    // Tab 补全
    if (key.tab && suggestions.length > 0) {
      handleSuggestionSelect(suggestions[0]);
    }
  });

  const getPromptSymbol = () => {
    switch (inputMode) {
      case 'command':
        return '⚡';
      case 'search':
        return '🔍';
      default:
        return '>';
    }
  };

  const getPromptColor = () => {
    switch (inputMode) {
      case 'command':
        return colors.primary;
      case 'search':
        return colors.info;
      default:
        return colors.success;
    }
  };

  return (
    <Box flexDirection="column">
      {/* 状态指示器 */}
      {showStatus && status !== 'idle' && (
        <Box marginBottom={1} paddingX={2}>
          <StatusIndicator status={status} />
        </Box>
      )}

      {/* 输入区域 */}
      {!disabled && (
        <Box flexDirection="column">
          {/* 分隔线 */}
          <Box paddingX={2}>
            <Text color={colors.border}>{'─'.repeat(80)}</Text>
          </Box>

          {/* 输入框 */}
          <Box flexDirection="row" alignItems="center" paddingX={2} paddingY={0}>
            {/* 提示符 */}
            <Text color={getPromptColor()} bold>
              {getPromptSymbol()}{' '}
            </Text>

            {/* 输入框 */}
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder={placeholder}
            />

            {/* 输入模式指示器 */}
            {inputMode !== 'normal' && (
              <Text color={colors.text.secondary} dimColor>
                {' '}
                [{inputMode}]
              </Text>
            )}
          </Box>

          {/* 分隔线 */}
          <Box paddingX={2}>
            <Text color={colors.border}>{'─'.repeat(80)}</Text>
          </Box>
        </Box>
      )}

      {/* 命令列表 - 显示在输入框下方*/}
      {showSuggestionBox && (
        <SuggestionBox
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          onCancel={handleSuggestionCancel}
          visible={showSuggestionBox}
          fullCommandList={shouldShowFullCommandList}
        />
      )}

      {/* 帮助提示 */}
      {input.length === 0 && !showSuggestionBox && (
        <Box paddingX={2} paddingTop={1}>
          <Text color={colors.text.secondary} dimColor>
            Ctrl+L Clear • Ctrl+R Search • Tab Complete • ↑↓ History
          </Text>
        </Box>
      )}
    </Box>
  );
};
