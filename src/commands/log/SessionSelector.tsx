import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { SessionInfo } from './LogCommand.js';

interface SessionSelectorProps {
  sessions: SessionInfo[];
  onSelect: (session: SessionInfo) => void;
  onCancel: () => void;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({
  sessions,
  onSelect,
  onCancel,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(sessions.length - 1, selectedIndex + 1));
    } else if (key.return) {
      onSelect(sessions[selectedIndex]);
    } else if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      <Text color="blue" bold>
        选择要查看的会话 (↑↓ 选择, Enter 确认, Esc 取消):
      </Text>
      <Text> </Text>

      {sessions.map((session, index) => (
        <Box key={session.id} flexDirection="row">
          <Text color={index === selectedIndex ? 'blue' : 'white'}>
            {index === selectedIndex ? '> ' : '  '}
          </Text>
          <Box flexDirection="column" flexGrow={1}>
            <Text color={index === selectedIndex ? 'blue' : 'white'} bold>
              {session.name}
            </Text>
            <Text color="gray" dimColor>
              {session.messageCount} 条消息 • {session.lastModified.toLocaleString()}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
