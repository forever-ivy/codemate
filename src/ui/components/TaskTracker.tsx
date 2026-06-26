/**
 * 任务跟踪组件
 */
import React from 'react';
import { Box, Text } from 'ink';
import type { AgentTimelineKind } from '../workbench/AgentTimelineService';

export interface TaskItem {
  id: string;
  kind: AgentTimelineKind;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  details?: string;
}

interface TaskTrackerProps {
  tasks: TaskItem[];
  currentTask?: string;
  showCompleted?: boolean;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({
  tasks,
  currentTask,
  showCompleted = true,
}) => {
  // 如果没有任务且没有当前任务，不显示
  if (tasks.length === 0 && !currentTask) return null;

  const getCheckboxIcon = (status: TaskItem['status']) => {
    switch (status) {
      case 'pending':
        return '☐'; // 空白复选框
      case 'running':
        return '◐'; // 半选中（进行中）
      case 'completed':
        return '☑'; // 已完成复选框
      case 'failed':
        return '☒'; // 失败复选框
      default:
        return '☐';
    }
  };

  const getStatusColor = (status: TaskItem['status']) => {
    switch (status) {
      case 'pending':
        return 'gray';
      case 'running':
        return 'blue';
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  // 分离计划步骤和工具执行
  const planTasks = tasks.filter((task) => task.id.includes('-plan-'));
  const toolTasks = tasks.filter((task) => !task.id.includes('-plan-'));

  const visibleToolTasks = showCompleted
    ? toolTasks
    : toolTasks.filter((task) => task.status !== 'completed');

  return (
    <Box flexDirection="column" marginY={1}>
      {/* 显示执行计划  */}
      {planTasks.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>
            📋 Execution Plan:
          </Text>
          {planTasks.map((task) => (
            <Box key={task.id} flexDirection="row" alignItems="center">
              <Box marginLeft={1}>
                <Text color={getStatusColor(task.status)} bold>
                  {getCheckboxIcon(task.status)}
                </Text>
              </Box>
              <Box marginLeft={1}>
                <Text color={task.status === 'completed' ? 'green' : 'gray'}>
                  {task.description}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* 显示当前任务 */}
      {currentTask && (
        <Box marginBottom={1}>
          <Text color="blue" bold>
            🔄 {currentTask}
          </Text>
        </Box>
      )}

      {/* 显示工具执行任务 */}
      {visibleToolTasks.length > 0 && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            🛠️ Tool Execution:
          </Text>
          {visibleToolTasks.map((task) => (
            <Box key={task.id} flexDirection="row" alignItems="center">
              <Box marginLeft={1}>
                <Text color={getStatusColor(task.status)} bold>
                  {getCheckboxIcon(task.status)}
                </Text>
              </Box>
              <Box marginLeft={1}>
                <Text color={getStatusColor(task.status)}>{task.description}</Text>

                {task.status === 'running' && (
                  <Box marginLeft={1}>
                    <Text color="blue" dimColor>
                      (in progress...)
                    </Text>
                  </Box>
                )}

                {task.details && task.status === 'completed' && (
                  <Box marginLeft={1}>
                    <Text color="gray" dimColor>
                      - {task.details}
                    </Text>
                  </Box>
                )}

                {task.details && task.status === 'failed' && (
                  <Box marginLeft={1}>
                    <Text color="red" dimColor>
                      - {task.details}
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};
