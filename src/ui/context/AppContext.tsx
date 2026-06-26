import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { Session, SessionMetadata } from '../../types/index';
import type { Application } from '../../application/Application';
import type { AgentProgressState } from '../components/AgentProgress/types';

/**
 * AppContext 类型定义
 */
export interface AppContextType {
  // 当前会话
  currentSession: Session | null;
  setCurrentSession: (session: Session | null) => void;

  // 会话列表
  sessions: SessionMetadata[];
  setSessions: (sessions: SessionMetadata[]) => void;

  // Application 实例
  app: Application;

  // Agent进度跟踪
  agentProgressMap: Record<string, AgentProgressState>;
  updateAgentProgress: (toolUseId: string, data: AgentProgressState) => void;
  clearAgentProgress: (toolUseId: string) => void;

  // Transcript模式
  transcriptMode: boolean;
  toggleTranscriptMode: () => void;
}

/**
 * 创建 Context
 */ const AppContext = createContext<AppContextType | null>(null);

/**
 * AppContextProvider Props
 */ interface AppContextProviderProps {
  app: Application;
  children: ReactNode;
}

/**
 * AppContextProvider 组件
 *
 * 提供全局状态管理
 */ export function AppContextProvider({ app, children }: AppContextProviderProps) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);

  // Agent进度跟踪状态
  const [agentProgressMap, setAgentProgressMap] = useState<Record<string, AgentProgressState>>({});
  const [transcriptMode, setTranscriptMode] = useState(false);

  // Agent进度管理函数
  const updateAgentProgress = (toolUseId: string, data: AgentProgressState) => {
    setAgentProgressMap((prev) => ({
      ...prev,
      [toolUseId]: data,
    }));
  };

  const clearAgentProgress = (toolUseId: string) => {
    setAgentProgressMap((prev) => {
      const newMap = { ...prev };
      delete newMap[toolUseId];
      return newMap;
    });
  };

  const toggleTranscriptMode = () => {
    setTranscriptMode((prev) => !prev);
  };

  const value: AppContextType = {
    currentSession,
    setCurrentSession,
    sessions,
    setSessions,
    app,
    agentProgressMap,
    updateAgentProgress,
    clearAgentProgress,
    transcriptMode,
    toggleTranscriptMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * useAppContext Hook
 *
 * 在任何组件中使用:
 * const { currentSession, app } = useAppContext();
 */ export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}
