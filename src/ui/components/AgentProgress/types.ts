/**
 * AI任务执行跟踪系统 - 类型定义
 */
import type { EnhancedMessage } from '../../../types/index';

export interface AgentProgressState {
  agentId: string;
  agentType: string;
  prompt: string;
  messages: EnhancedMessage[];
  status: 'running' | 'completed' | 'failed';
  lastUpdate: number;
  model?: string;
}

export interface ToolUsePart {
  type: 'tool_use';
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  input: Record<string, any>;
}

export interface ToolResultPart {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface LogItem {
  type: 'user' | 'tool' | 'text';
  content?: string;
  toolUse?: ToolUsePart;
  toolResult?: ToolResultPart;
  id: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface TaskStats {
  toolCalls: number;
  tokens: number;
  duration?: number;
}
