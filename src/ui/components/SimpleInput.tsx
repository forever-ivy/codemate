import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
/**
 * 简化输入组件 - 专门解决闪烁和布局问题
 *
 * 移除所有可能导致闪烁的复杂功能，只保留核心输入功能
 * 修复右移动问题
 * 恢复命令自动补全功能
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';

interface Suggestion {
  text: string;
  description: string;
  type: 'command' | 'parameter' | 'file' | 'history';
  priority: number;
}

interface SimpleInputProps {
  onSubmit: (value: string) => void;
  onDraftChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hidden?: boolean;
  width?: number;
  disabledHint?: string;
}

const MAX_VISIBLE_SUGGESTIONS = 8;

// 简化的建议引擎
class SimpleSuggestionEngine {
  private commands: string[] = [
    '/help',
    '/clear',
    '/exit',
    '/model',
    '/config',
    '/status',
    '/commit',
    '/workspace',
    '/log',
    '/skill',
    '/agent',
    '/fork',
    '/rewind',
    '/resume',
    '/mcp',
  ];

  getSuggestions(input: string): Suggestion[] {
    // 特殊处理：当输入只是 "/" 时，显示所有命令
    if (input === '/') {
      return this.commands.map((cmd) => ({
        text: cmd,
        description: this.getCommandDescription(cmd),
        type: 'command' as const,
        priority: 10,
      }));
    }

    // 命令补全
    if (input.startsWith('/')) {
      const matchingCommands = this.commands.filter((cmd) =>
        cmd.toLowerCase().startsWith(input.toLowerCase())
      );

      return matchingCommands.map((cmd) => ({
        text: cmd,
        description: this.getCommandDescription(cmd),
        type: 'command' as const,
        priority: 10,
      }));
    }

    return [];
  }

  private getCommandDescription(command: string): string {
    const descriptions: Record<string, string> = {
      '/help': 'Show available slash commands and usage',
      '/clear': 'Start a new session',
      '/exit': 'Exit the application',
      '/model': 'Select a model',
      '/config': 'Application settings and configuration',
      '/status': 'Show system status and statistics',
      '/commit': 'Smart git commit with AI-generated messages',
      '/workspace': 'Workspace management and git worktree operations',
      '/log': 'View session logs in HTML format',
      '/skill': 'Manage skills and custom commands',
      '/agent': 'Agent operations and subagent management',
      '/fork': 'Fork current conversation at any point',
      '/rewind': 'Rewind to previous conversation state',
      '/resume': 'Resume from a specific session',
      '/mcp': 'MCP servers management',
    };

    return descriptions[command] || 'Command';
  }
}

const SimpleInputComponent: React.FC<SimpleInputProps> = ({
  onSubmit,
  onDraftChange,
  placeholder = 'Type your message...',
  disabled = false,
  hidden = false,
  width,
  disabledHint = 'Agent is working • Ctrl+C to stop or exit',
}) => {
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);

  const suggestionEngine = useRef(new SimpleSuggestionEngine());
  const submittedValueRef = useRef<string | null>(null);
  const isInteractive = !disabled && !hidden;

  const suggestions = useMemo(() => suggestionEngine.current.getSuggestions(input), [input]);
  const showSuggestions =
    isInteractive && input.startsWith('/') && suggestions.length > 0 && !suggestionsDismissed;

  const handleChange = useCallback(
    (value: string) => {
      setInput(value);
      setSelectedIndex(0);
      setSuggestionsDismissed(false);
      onDraftChange?.(value);
    },
    [onDraftChange]
  );

  // 键盘导航
  useInput((_inputChar, key) => {
    if (!showSuggestions || !isInteractive) return;

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev === 0 ? suggestions.length - 1 : prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev === suggestions.length - 1 ? 0 : prev + 1));
    } else if (key.return && suggestions[selectedIndex]) {
      const selectedSuggestion = suggestions[selectedIndex].text;

      // 输入已经是完整命令时，回车应直接提交，由 TextInput 的 onSubmit 负责清空输入框。
      if (input !== selectedSuggestion) {
        handleChange(selectedSuggestion);
      } else if (submittedValueRef.current === selectedSuggestion) {
        handleChange('');
        submittedValueRef.current = null;
      }
      setSuggestionsDismissed(true);
    } else if (key.escape) {
      setSuggestionsDismissed(true);
    } else if (key.tab && suggestions[selectedIndex]) {
      handleChange(suggestions[selectedIndex].text);
      setSuggestionsDismissed(true);
    }
  });

  const handleSubmit = useCallback(
    (value: string) => {
      if (!value.trim() || disabled) return;

      submittedValueRef.current = value;

      // 立即清空输入
      handleChange('');
      setSuggestionsDismissed(true);

      // 提交
      onSubmit(value);
    },
    [onSubmit, disabled, handleChange]
  );

  // 简化提示符，避免宽度变化
  const promptSymbol = '>';
  const promptColor = input.startsWith('/') ? 'blue' : 'green';
  const dividerWidth = Math.max(10, (width ?? process.stdout.columns ?? 80) - 6);

  const visibleSuggestions =
    showSuggestions && suggestions.length > 0
      ? Array.from(
          { length: Math.min(MAX_VISIBLE_SUGGESTIONS, suggestions.length) },
          (_, offset) => {
            const index = (selectedIndex + offset) % suggestions.length;
            return {
              suggestion: suggestions[index],
              index,
            };
          }
        )
      : [];

  return (
    <Box flexDirection="column" display={hidden ? 'none' : 'flex'}>
      {/* 默认状态下不在输入框下方预留空间，保持输入框贴底 */}
      {!showSuggestions && (
        <Box paddingX={2} marginBottom={1}>
          <Text color="gray" dimColor>
            {disabled
              ? disabledHint
              : input.length === 0
                ? 'Type / for commands • Enter to send'
                : ' '}
          </Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Box paddingX={2}>
          <Text color="gray">{'─'.repeat(dividerWidth)}</Text>
        </Box>

        <Box paddingX={2}>
          <Box flexDirection="row" alignItems="center">
            <Text color={disabled ? 'gray' : promptColor} bold>
              {promptSymbol}{' '}
            </Text>

            <TextInput
              value={input}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder={disabled ? disabledHint : placeholder}
              focus={isInteractive}
            />
          </Box>
        </Box>

        <Box paddingX={2}>
          <Text color="gray">{'─'.repeat(dividerWidth)}</Text>
        </Box>
      </Box>

      {showSuggestions && suggestions.length > 0 && (
        <Box flexDirection="column" paddingX={2} marginTop={1}>
          {visibleSuggestions.map(({ suggestion, index }) => (
            <Box key={`${suggestion.text}-${index}`} flexDirection="row" width="100%">
              <Box width={20} flexShrink={0}>
                <Text
                  color={index === selectedIndex ? 'cyan' : 'gray'}
                  bold={index === selectedIndex}
                >
                  {suggestion.text}
                </Text>
              </Box>

              <Box flexGrow={1}>
                <Text
                  color={index === selectedIndex ? 'white' : 'dim'}
                  dimColor={index !== selectedIndex}
                  wrap="truncate-end"
                >
                  {suggestion.description}
                </Text>
              </Box>
            </Box>
          ))}

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              ↑↓ navigate • Enter/Tab select • Esc cancel
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const SimpleInput = React.memo(SimpleInputComponent);
