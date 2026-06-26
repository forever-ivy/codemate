/**
 * Agent进度组件 - 主入口
 */
import React from 'react';
import type { ToolUsePart, ToolResultPart } from './types';
import { useAppContext } from '../../context/AppContext';
import { AgentCompletedResult, AgentInProgress, AgentStarting } from './AgentProgressOverlay';

interface AgentProgressProps {
  toolUse: ToolUsePart;
  toolResult?: ToolResultPart;
}

export function AgentProgress({ toolUse, toolResult }: AgentProgressProps) {
  const { agentProgressMap } = useAppContext();
  const progressData = agentProgressMap?.[toolUse.id];

  // 优先检查toolResult - 如果结果存在，任务已完成
  if (toolResult) {
    return <AgentCompletedResult toolUse={toolUse} toolResult={toolResult} />;
  }

  if (progressData && progressData.status === 'running') {
    return <AgentInProgress toolUse={toolUse} progressData={progressData} />;
  }

  return <AgentStarting toolUse={toolUse} />;
}

// 导出所有相关组件和类型
export * from './types';
export * from './utils';
export * from './AgentProgressOverlay';
export * from './LogItemRenderer';
