import { Box, Text } from 'ink';
// biome-ignore lint/style/useImportType: this project uses the classic JSX transform and needs React at runtime.
import React, { useMemo } from 'react';
import type { ToolApprovalRequest } from '../../tools/ToolApprovalRequestService';
import type { EnhancedMessage } from '../../types/index';
import type { QueuedAgentMessage } from '../hooks/useAgentMessageQueue';
import { useTheme } from '../theme/ThemeSystem';
import type { AgentRunSummary } from '../workbench/AgentRunSummaryService';
import {
  type AgentWorkbenchStatus,
  buildAgentWorkbenchViewModel,
} from '../workbench/AgentWorkbenchViewModel';
import { buildStableTerminalFrame } from '../workbench/StableTerminalRenderKernel';
import { AgentProgressTimeline } from './AgentProgressTimeline';
import { AgentRunSummaryList } from './AgentRunSummaryList';
import { EnhancedMessageList } from './EnhancedMessageList';
import { LiveModelOutput, type LiveModelOutputState } from './LiveModelOutput';
import { ProcessingIndicator } from './ProcessingIndicator';
import { QueuedMessageList } from './QueuedMessageList';
import type { TaskItem } from './TaskTracker';
import { WelcomeScreen } from './WelcomeScreen';
import { WorkbenchTranscript } from './WorkbenchTranscript';

interface AgentWorkbenchProps {
  messages: EnhancedMessage[];
  tasks: TaskItem[];
  currentTask?: string;
  status: AgentWorkbenchStatus;
  isLoading: boolean;
  sessionId?: string;
  model: string;
  project: string;
  version?: string;
  pendingApproval?: ToolApprovalRequest;
  runSummaries?: AgentRunSummary[];
  liveModelOutput?: LiveModelOutputState;
  queuedMessages?: QueuedAgentMessage[];
  onRemoveQueuedMessage?: (id: string) => void;
  dynamicMessageStartIndex?: number;
  inputDraftActive?: boolean;
}

/**
 * Main terminal workspace for the coding agent experience.
 *
 * App owns raw runtime state. This component turns that state into a stable
 * workbench shell: phase header, activity summary, task panel and message
 * transcript. Later chapters can replace the task panel with richer timeline
 * and approval cards without reshaping App again.
 */
const AgentWorkbenchComponent: React.FC<AgentWorkbenchProps> = ({
  messages,
  tasks,
  currentTask = '',
  status,
  isLoading,
  sessionId,
  model,
  project,
  version = 'v1.0.5',
  pendingApproval,
  runSummaries = [],
  liveModelOutput,
  queuedMessages = [],
  onRemoveQueuedMessage = () => {},
  dynamicMessageStartIndex,
  inputDraftActive = false,
}) => {
  const theme = useTheme();
  const colors = theme.getCurrentTheme();
  const viewModel = useMemo(
    () =>
      buildAgentWorkbenchViewModel({
        messages,
        tasks,
        currentTask,
        status,
        isLoading,
        sessionId,
        model,
        project,
      }),
    [messages, tasks, currentTask, status, isLoading, sessionId, model, project]
  );
  const runActive = isLoading || tasks.some((task) => task.status === 'running');
  const terminalFrame = useMemo(
    () =>
      buildStableTerminalFrame({
        messages,
        runActive,
        dynamicMessageStartIndex,
        pendingApproval,
        liveOutputVisible: Boolean(liveModelOutput),
        inputDraftActive,
      }),
    [
      messages,
      runActive,
      dynamicMessageStartIndex,
      pendingApproval,
      liveModelOutput,
      inputDraftActive,
    ]
  );
  const processingStartedAt = useMemo(() => {
    const starts = tasks
      .map((task) => task.startTime)
      .filter((value): value is number => value !== undefined);
    return starts.length > 0 ? Math.min(...starts) : undefined;
  }, [tasks]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row">
            <Text color={colors.primary} bold>
              CodeMate Workbench
            </Text>
            <Text color={colors.text.secondary}> · </Text>
            <Text color={phaseColor(viewModel.phase)}>{viewModel.phaseLabel}</Text>
          </Box>
          <Text color={colors.text.secondary}>
            {viewModel.model} · {viewModel.project}
          </Text>
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          <Text color={colors.text.secondary}>{viewModel.activitySummary}</Text>
          <Text color={colors.text.secondary}>{viewModel.hint}</Text>
        </Box>
      </Box>

      {messages.length === 0 &&
        runSummaries.length === 0 &&
        tasks.length === 0 &&
        !isLoading &&
        !pendingApproval &&
        !liveModelOutput && <WelcomeScreen version={version} showTips={true} />}

      <WorkbenchTranscript messages={terminalFrame.transcript.completedMessages} maxMessages={20} />

      {terminalFrame.transcript.pendingMessages.length > 0 && (
        <EnhancedMessageList
          messages={terminalFrame.transcript.pendingMessages}
          isStreaming={false}
          streamingText=""
          showTimestamps={false}
          showMessageIds={false}
          maxVisibleMessages={terminalFrame.transcript.pendingMessages.length}
        />
      )}

      <ProcessingIndicator
        active={
          terminalFrame.slots.activity.visible &&
          !terminalFrame.slots.approval.visible &&
          !terminalFrame.slots.liveOutput.visible
        }
        startedAt={processingStartedAt}
        currentTask={currentTask}
      />

      {!inputDraftActive && tasks.length > 0 && (
        <AgentProgressTimeline tasks={tasks} currentTask={currentTask} />
      )}

      <LiveModelOutput
        output={terminalFrame.slots.liveOutput.visible ? liveModelOutput : undefined}
      />

      <QueuedMessageList messages={queuedMessages} onRemove={onRemoveQueuedMessage} />

      {runSummaries.length > 0 && <AgentRunSummaryList summaries={runSummaries} />}
    </Box>
  );
};

export const AgentWorkbench = React.memo(AgentWorkbenchComponent);

function phaseColor(phase: ReturnType<typeof buildAgentWorkbenchViewModel>['phase']): string {
  switch (phase) {
    case 'thinking':
      return 'yellow';
    case 'acting':
      return 'blue';
    case 'blocked':
      return 'red';
    default:
      return 'green';
  }
}
