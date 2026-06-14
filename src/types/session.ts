/**
 * 会话信息接口
 */
export interface SessionInfo {
  sessionId: string;
  modified: Date;
  created: Date;
  messageCount: number;
  gitBranch?: string;
  summary?: string;
}

/**
 * Resume选择器选项
 */
export interface ResumeOptions {
  sessions: SessionInfo[];
  onSelect: (sessionId: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * 会话数据结构
 */
export interface SessionData {
  id: string;
  messages: Message[];
  created: Date;
  lastModified: Date;
  metadata?: {
    gitBranch?: string;
    workingDirectory?: string;
    summary?: string;
  };
}

/**
 * 消息接口
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}
