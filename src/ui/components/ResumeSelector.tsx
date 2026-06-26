import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ResumeOptions } from '../../types/session';
import { TimeFormatter } from '../../utils/timeFormatter';

/**
 * ResumeSelector - 会话恢复选择器
 *
 * 提供交互式界面让用户选择要恢复的会话
 */
export const ResumeSelector: React.FC<ResumeOptions> = ({ sessions, onSelect, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sessions.length);
  const currentSessions = sessions.slice(startIndex, endIndex);

  // 键盘事件处理
  useInput((_input, key) => {
    if (loading) return;

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(currentSessions.length - 1, prev + 1));
    } else if (key.leftArrow && currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
      setSelectedIndex(0);
    } else if (key.rightArrow && currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
      setSelectedIndex(0);
    } else if (key.return) {
      handleSelect();
    } else if (key.escape) {
      onCancel();
    }
  });

  const handleSelect = async () => {
    if (selectedIndex >= 0 && selectedIndex < currentSessions.length) {
      setLoading(true);
      const session = currentSessions[selectedIndex];
      await onSelect(session.sessionId);
    }
  };

  if (loading) {
    return (
      <Box borderStyle="round" borderColor="blue" padding={1}>
        <Text color="blue">🔄 Resuming session...</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="round" borderColor="gray" flexDirection="column" padding={1}>
      {/* 标题 */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📚 Resume Session
        </Text>
        <Text color="gray"> ({sessions.length} total)</Text>
      </Box>

      {/* 列标题 */}
      <Box marginBottom={1}>
        <Text color="gray">
          {'  '}
          {'Modified'.padEnd(12)}
          {'Created'.padEnd(12)}
          {'Messages'.padEnd(8)}
          {'Summary'}
        </Text>
      </Box>

      {/* 会话列表 */}
      {currentSessions.map((session, index) => {
        const isSelected = index === selectedIndex;
        const marker = isSelected ? '👉' : '  ';
        const color = isSelected ? 'cyan' : 'white';

        return (
          <Box key={session.sessionId}>
            <Text color={color}>
              {marker}
              {TimeFormatter.formatRelativeTime(session.modified).padEnd(12)}
              {TimeFormatter.formatRelativeTime(session.created).padEnd(12)}
              {session.messageCount.toString().padEnd(8)}
              {session.summary || 'No summary'}
            </Text>
          </Box>
        );
      })}

      {/* 分页信息 */}
      {totalPages > 1 && (
        <Box marginTop={1} justifyContent="space-between">
          <Text color="gray">
            Page {currentPage + 1} of {totalPages}
          </Text>
          <Text color="gray">← → to navigate pages</Text>
        </Box>
      )}

      {/* 操作提示 */}
      <Box marginTop={1}>
        <Text color="gray">↑↓ Select • Enter Confirm • ESC Cancel</Text>
      </Box>
    </Box>
  );
};
