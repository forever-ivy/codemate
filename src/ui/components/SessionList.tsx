import React from 'react';
import { Box, Text } from 'ink';
import type { SessionMetadata } from '../../types/index';

/**
 * SessionList Props
 */
interface SessionListProps {
  sessions: SessionMetadata[];
  currentSessionId: string | null;
  onSelect?: (sessionId: string) => void;
}

/**
 * SessionList 组件
 *
 * 显示会话列表
 */
export function SessionList({ sessions, currentSessionId, onSelect: _onSelect }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray">No sessions yet.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        📋 Sessions:
      </Text>
      {sessions.map((session) => {
        const isCurrent = session.sessionId === currentSessionId;
        return (
          <Box key={session.sessionId} marginLeft={2}>
            <Text color={isCurrent ? 'green' : 'white'}>
              {isCurrent ? '▶ ' : '  '}
              {session.sessionId}: {session.summary || 'Untitled'} ({session.messageCount} messages)
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
