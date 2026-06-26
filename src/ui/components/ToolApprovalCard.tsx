import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React from 'react';
import type { ToolApprovalRequest } from '../../tools/ToolApprovalRequestService';
import { useTheme } from '../theme/ThemeSystem';

interface ToolApprovalCardProps {
  request: ToolApprovalRequest;
}

/**
 * Shows a pending tool approval request inside the workbench.
 *
 * The component is intentionally display-only. App owns keyboard handling and
 * sends `tool_approval_response` events back to ToolManager.
 */
export const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({ request }) => {
  const colors = useTheme().getCurrentTheme();
  const diffLines = request.preview.diff?.split('\n').filter(Boolean) ?? [];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginBottom={1}
      flexShrink={0}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text color="yellow" bold>
          Approval Needed · waiting for your decision
        </Text>
        <Text color="yellow">a approve · d deny · Esc deny · no Enter</Text>
      </Box>

      <Text>
        Tool waiting: <Text color="cyan">{request.toolName}</Text>
      </Text>
      <Text>
        Risk: <Text color="yellow">{request.approval.risk}</Text>
      </Text>
      <Text color={colors.text.secondary}>{request.approval.reason}</Text>
      <Text color={colors.text.secondary}>{request.preview.summary}</Text>

      {request.preview.relativePath && (
        <Text>
          File: <Text color="cyan">{request.preview.relativePath}</Text>
        </Text>
      )}

      {diffLines.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.text.secondary}>Diff preview:</Text>
          {diffLines.slice(0, 12).map((line, index) => (
            <Text key={`${request.id}-${index}`} color={diffColor(line)}>
              {line}
            </Text>
          ))}
          {diffLines.length > 12 && (
            <Text color={colors.text.secondary} dimColor>
              {`${diffLines.length - 12} more diff lines hidden`}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

function diffColor(line: string): string {
  if (line.startsWith('+')) {
    return 'green';
  }
  if (line.startsWith('-')) {
    return 'red';
  }
  return 'gray';
}
