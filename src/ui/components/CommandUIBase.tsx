import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useTheme } from '../theme/ThemeSystem.js';
import type {
  KeyboardShortcut,
  CommandMetadata,
} from '../../commands/base/EnhancedSlashCommand.js';

export interface CommandUIBaseProps {
  metadata: CommandMetadata;
  data: any[];
  loading: boolean;
  error: string | null;
  selectedIndex: number;
  searchQuery: string;
  filters: Record<string, any>;
  viewMode: 'list' | 'grid' | 'detail';
  shortcuts: KeyboardShortcut[];
  onSelect: (item: any, index: number) => void;
  onSearch: (query: string) => void;
  onFilter: (filters: Record<string, any>) => void;
  onViewModeChange: (mode: 'list' | 'grid' | 'detail') => void;
  onExit: () => void;
  renderItem: (item: any, index: number, selected: boolean) => React.ReactNode;
  renderDetail?: (item: any) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  renderError?: (error: string) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
}

export const CommandUIBase: React.FC<CommandUIBaseProps> = ({
  metadata,
  data,
  loading,
  error,
  selectedIndex,
  searchQuery,
  filters,
  viewMode,
  shortcuts,
  onSelect,
  onSearch,
  onFilter: _onFilter,
  onViewModeChange,
  onExit,
  renderItem,
  renderDetail,
  renderEmpty,
  renderError,
  renderLoading,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const theme = useTheme();
  const colors = theme.getCurrentTheme();

  // 键盘事件处理
  useInput((input, key) => {
    if (showSearch) {
      if (key.escape) {
        setShowSearch(false);
        onSearch('');
      }
      return;
    }

    if (showFilters) {
      if (key.escape) {
        setShowFilters(false);
      }
      return;
    }

    if (showHelp) {
      if (key.escape || input === '?') {
        setShowHelp(false);
      }
      return;
    }

    // 通用快捷键
    if (key.escape) {
      onExit();
    } else if (input === '/') {
      setShowSearch(true);
    } else if (input === 'f' || input === 'F') {
      setShowFilters(true);
    } else if (input === '?') {
      setShowHelp(true);
    } else if (input === '1') {
      onViewModeChange('list');
    } else if (input === '2') {
      onViewModeChange('grid');
    } else if (input === '3') {
      onViewModeChange('detail');
    } else if (key.upArrow) {
      const newIndex = Math.max(0, selectedIndex - 1);
      if (data[newIndex]) {
        onSelect(data[newIndex], newIndex);
      }
    } else if (key.downArrow) {
      const newIndex = Math.min(data.length - 1, selectedIndex + 1);
      if (data[newIndex]) {
        onSelect(data[newIndex], newIndex);
      }
    } else if (key.return) {
      if (data[selectedIndex]) {
        onSelect(data[selectedIndex], selectedIndex);
      }
    } else {
      // 处理自定义快捷键
      const shortcut = shortcuts.find((s) => s.key.toLowerCase() === input.toLowerCase());
      if (shortcut) {
        shortcut.handler();
      }
    }
  });

  // 渲染标题栏
  const renderHeader = () => (
    <Box borderStyle="single" paddingX={2} paddingY={1}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box flexDirection="row">
          {metadata.icon && (
            <Box marginRight={1}>
              <Text color={metadata.color || colors.primary}>{metadata.icon}</Text>
            </Box>
          )}
          <Text bold color={colors.primary}>
            {metadata.title}
          </Text>
          {data.length > 0 && (
            <Box marginLeft={1}>
              <Text color={colors.text.secondary}>({data.length})</Text>
            </Box>
          )}
        </Box>
        <Box flexDirection="row">
          <Box marginRight={2}>
            <Text color={colors.text.secondary}>View: {viewMode}</Text>
          </Box>
          <Text color={colors.text.secondary}>? for help</Text>
        </Box>
      </Box>
    </Box>
  );

  // 渲染搜索栏
  const renderSearchBar = () => {
    if (!showSearch) {
      return (
        <Box paddingX={2} paddingY={1}>
          <Text color={colors.text.secondary}>
            Press / to search • f to filter • ↑↓ to navigate • Enter to select
          </Text>
        </Box>
      );
    }

    return (
      <Box borderStyle="single" paddingX={2} paddingY={1}>
        <Box flexDirection="row">
          <Box marginRight={1}>
            <Text color={colors.info}>🔍</Text>
          </Box>
          <TextInput value={searchQuery} onChange={onSearch} placeholder="Type to search..." />
          <Box marginLeft={2}>
            <Text color={colors.text.secondary}>(Esc to cancel)</Text>
          </Box>
        </Box>
      </Box>
    );
  };

  // 渲染过滤器栏
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Box borderStyle="single" paddingX={2} paddingY={1}>
        <Text color={colors.warning} bold>
          Filters
        </Text>
        <Text color={colors.text.secondary}>Filter options will be displayed here</Text>
      </Box>
    );
  };

  // 渲染内容区域
  const renderContent = () => {
    if (loading) {
      return renderLoading ? (
        renderLoading()
      ) : (
        <Box justifyContent="center" paddingY={2}>
          <Text color={colors.info}>⏳ Loading...</Text>
        </Box>
      );
    }

    if (error) {
      return renderError ? (
        renderError(error)
      ) : (
        <Box justifyContent="center" paddingY={2}>
          <Text color={colors.error}>❌ Error: {error}</Text>
        </Box>
      );
    }

    if (data.length === 0) {
      return renderEmpty ? (
        renderEmpty()
      ) : (
        <Box justifyContent="center" paddingY={2}>
          <Text color={colors.text.secondary}>No items found</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column" paddingX={2} flexGrow={1}>
        {viewMode === 'detail' && data[selectedIndex] && renderDetail
          ? renderDetail(data[selectedIndex])
          : data.map((item, index) => (
              <Box key={index}>{renderItem(item, index, index === selectedIndex)}</Box>
            ))}
      </Box>
    );
  };

  // 渲染快捷键帮助
  const renderHelp = () => {
    if (!showHelp) return null;

    const groupedShortcuts = shortcuts.reduce(
      (groups, shortcut) => {
        const category = shortcut.category || 'General';
        if (!groups[category]) groups[category] = [];
        groups[category].push(shortcut);
        return groups;
      },
      {} as Record<string, KeyboardShortcut[]>
    );

    return (
      <Box borderStyle="single" paddingX={2} paddingY={1}>
        <Box marginBottom={1}>
          <Text bold color={colors.primary}>
            Keyboard Shortcuts
          </Text>
        </Box>
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <Box key={category} flexDirection="column" marginBottom={1}>
            <Text bold color={colors.warning}>
              {category}:
            </Text>
            {categoryShortcuts.map((shortcut, index) => (
              <Box key={index} flexDirection="row" marginLeft={2}>
                <Box minWidth={8}>
                  <Text color={colors.info} bold>
                    {shortcut.key}
                  </Text>
                </Box>
                <Text color={colors.text.primary}>{shortcut.description}</Text>
              </Box>
            ))}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text color={colors.text.secondary}>Press ? or Esc to close help</Text>
        </Box>
      </Box>
    );
  };

  // 渲染状态栏
  const renderStatusBar = () => (
    <Box borderStyle="single" paddingX={2} paddingY={1}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box flexDirection="row">
          {searchQuery && (
            <Box marginRight={2}>
              <Text color={colors.info}>🔍 "{searchQuery}"</Text>
            </Box>
          )}
          {Object.keys(filters).length > 0 && (
            <Box marginRight={2}>
              <Text color={colors.warning}>🔽 {Object.keys(filters).length} filters</Text>
            </Box>
          )}
        </Box>
        <Box flexDirection="row">
          <Text color={colors.text.secondary}>
            {data.length > 0 && `${selectedIndex + 1}/${data.length}`}
          </Text>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" height="100%">
      {renderHeader()}
      {renderSearchBar()}
      {renderFilters()}
      {renderHelp()}
      {renderContent()}
      {renderStatusBar()}
    </Box>
  );
};
