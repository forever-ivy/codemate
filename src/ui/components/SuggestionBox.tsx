/**
 * 智能建议系统
 *
 * 提供命令补全、历史记录等智能提示
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme/ThemeSystem.js';

interface Suggestion {
  text: string;
  description: string;
  type: 'command' | 'parameter' | 'file' | 'history';
  priority: number;
}

interface SuggestionBoxProps {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  onCancel: () => void;
  visible: boolean;
  maxVisible?: number;
  fullCommandList?: boolean; // 新增：是否显示完整命令列表
}

export const SuggestionBox: React.FC<SuggestionBoxProps> = React.memo(
  ({ suggestions, onSelect, onCancel, visible, maxVisible = 5, fullCommandList = false }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const theme = useTheme();
    const colors = theme.getCurrentTheme();

    // 🔥 关键修复：限制显示的命令数量，使用 useMemo 缓存
    const maxDisplayCommands = fullCommandList ? 10 : maxVisible;
    const displaySuggestions = useMemo(
      () => suggestions.slice(0, maxDisplayCommands),
      [suggestions, maxDisplayCommands]
    );

    // 🔥 优化1：只在显示的命令数量变化时重置，避免闪烁
    useEffect(() => {
      setSelectedIndex(0);
    }, [displaySuggestions.length]);

    // 🔥 优化2：支持循环选择（只在显示的命令范围内）
    useInput((_input, key) => {
      if (!visible) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => {
          // 循环：如果在第一个，跳到最后一个（显示的最后一个）
          if (prev === 0) {
            return displaySuggestions.length - 1;
          }
          return prev - 1;
        });
      } else if (key.downArrow) {
        setSelectedIndex((prev) => {
          // 循环：如果在最后一个，跳到第一个（显示的最后一个）
          if (prev === displaySuggestions.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      } else if (key.return) {
        if (displaySuggestions[selectedIndex]) {
          onSelect(displaySuggestions[selectedIndex]);
        }
      } else if (key.escape) {
        onCancel();
      }
    });

    if (!visible || displaySuggestions.length === 0) {
      return null;
    }

    const visibleSuggestions = displaySuggestions;

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'command':
          return '⚡';
        case 'parameter':
          return '🔧';
        case 'file':
          return '📄';
        case 'history':
          return '🕒';
        default:
          return '💡';
      }
    };

    if (fullCommandList) {
      return (
        <Box flexDirection="column" marginLeft={2}>
          {visibleSuggestions.map((suggestion, index) => (
            <Box key={index} flexDirection="row">
              {/* 左侧：命令名 */}
              <Box width={20}>
                <Text color={index === selectedIndex ? 'cyan' : 'gray'}>{suggestion.text}</Text>
              </Box>

              {/* 右侧：描述 */}
              <Text color="dim" dimColor>
                {suggestion.description}
              </Text>
            </Box>
          ))}
        </Box>
      );
    }

    // 原有的紧凑建议框
    return (
      <Box flexDirection="column" marginLeft={2}>
        {visibleSuggestions.map((suggestion, index) => (
          <Box key={index} flexDirection="row">
            <Box width={20}>
              <Text color={index === selectedIndex ? 'cyan' : 'gray'}>
                {getTypeIcon(suggestion.type)} {suggestion.text}
              </Text>
            </Box>

            {suggestion.description && (
              <Text color="dim" dimColor>
                {suggestion.description}
              </Text>
            )}
          </Box>
        ))}

        {suggestions.length > displaySuggestions.length && (
          <Box marginLeft={2}>
            <Text color={colors.text.secondary} dimColor>
              ... and {suggestions.length - displaySuggestions.length} more
            </Text>
          </Box>
        )}
      </Box>
    );
  }
);

// 建议引擎
export class SuggestionEngine {
  private commandHistory: string[] = [];
  private commands: string[] = [
    '/help',
    '/clear',
    '/exit',
    '/sessions',
    '/model',
    '/config',
    '/status',
    '/mcp',
    '/commit',
    '/workspace',
    '/log',
    '/skill',
    '/agent',
    '/fork',
    '/rewind',
    '/resume',
    '/snapshots',
  ];

  async getSuggestions(input: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // 特殊处理：当输入只是 "/" 时，显示所有命令
    if (input === '/') {
      const allCommands = this.commands.map((cmd) => ({
        text: cmd,
        description: this.getCommandDescription(cmd),
        type: 'command' as const,
        priority: 10,
      }));
      return allCommands;
    }

    // 命令补全
    if (input.startsWith('/')) {
      const matchingCommands = this.commands.filter((cmd) =>
        cmd.toLowerCase().startsWith(input.toLowerCase())
      );

      suggestions.push(
        ...matchingCommands.map((cmd) => ({
          text: cmd,
          description: this.getCommandDescription(cmd),
          type: 'command' as const,
          priority: 10,
        }))
      );
    }

    // 历史记录建议 - 只有在不是完全匹配命令时才显示
    if (!input.startsWith('/') || !this.commands.includes(input)) {
      const matchingHistory = this.commandHistory
        .filter(
          (item) =>
            item.toLowerCase().includes(input.toLowerCase()) && !this.commands.includes(item) // 避免重复显示命令
        )
        .slice(0, 3);

      suggestions.push(
        ...matchingHistory.map((item) => ({
          text: item,
          description: 'From history',
          type: 'history' as const,
          priority: 5,
        }))
      );
    }

    // 文件路径建议（简化实现）
    if (input.includes('./') || input.includes('../')) {
      // 这里可以实现文件系统扫描
      suggestions.push({
        text: input + 'example.ts',
        description: 'File suggestion',
        type: 'file',
        priority: 7,
      });
    }

    // 按优先级排序
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  addToHistory(command: string): void {
    this.commandHistory.unshift(command);
    // 保持历史记录在合理大小
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(0, 100);
    }
  }

  private getCommandDescription(command: string): string {
    const descriptions: Record<string, string> = {
      '/help': 'Show available slash commands and usage',
      '/clear': 'Start a new session',
      '/exit': 'Exit the application',
      '/sessions': 'Manage and switch between sessions',
      '/model': 'Select a model',
      '/config': 'Application settings and configuration',
      '/status': 'Show system status and statistics',
      '/mcp': 'MCP servers management',
      '/commit': 'Smart git commit with AI-generated messages',
      '/workspace': 'Workspace management and git worktree operations',
      '/log': 'View session logs in HTML format',
      '/skill': 'Manage skills and custom commands',
      '/agent': 'Agent operations and subagent management',
      '/fork': 'Fork current conversation at any point',
      '/rewind': 'Rewind to previous conversation state',
      '/resume': 'Resume from a specific session',
      '/snapshots': 'List all file snapshots',
    };

    return descriptions[command] || 'Command';
  }
}
