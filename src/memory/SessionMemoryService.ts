import type { Message } from '../types/index';

export interface SessionMemoryEntry {
  turn: number;
  user: string;
  assistant?: string;
}

export interface SessionMemorySnapshot {
  generatedAt: number;
  entryCount: number;
  entries: SessionMemoryEntry[];
  prompt: string;
}

export interface SessionMemoryOptions {
  maxTurns?: number;
  maxCharsPerMessage?: number;
}

/**
 * SessionMemoryService 从当前会话消息中提取短期任务记忆。
 *
 * 调用链路：
 * AgentLoop.execute -> SessionMemoryService.build -> AgentLoop.buildModelMessage
 *
 * 它只读取已经存在的会话消息，不写入文件，也不做长期记忆。
 * Project Memory 和 User Preference Memory 会在后续章节单独实现。
 */
export class SessionMemoryService {
  constructor(private options: SessionMemoryOptions = {}) {}

  /**
   * 把已有会话消息压缩成适合注入模型的短记忆 prompt。
   */
  build(messages: Message[]): SessionMemorySnapshot {
    // 1. 会话消息可能包含多轮 user/assistant。这里先折叠成任务 turn，
    //    避免直接把完整历史塞进模型输入。
    const entries = this.buildEntries(messages).slice(-(this.options.maxTurns ?? 3));

    // 2. 没有历史任务时返回空 prompt。调用方可以直接跳过注入。
    if (entries.length === 0) {
      return {
        generatedAt: Date.now(),
        entryCount: 0,
        entries: [],
        prompt: '',
      };
    }

    // 3. 生成短 prompt。它只描述最近任务，不替代完整 session log。
    return {
      generatedAt: Date.now(),
      entryCount: entries.length,
      entries,
      prompt: this.formatPrompt(entries),
    };
  }

  private buildEntries(messages: Message[]): SessionMemoryEntry[] {
    const entries: SessionMemoryEntry[] = [];
    let currentUser: string | undefined;

    for (const message of messages) {
      const content = this.normalizeContent(message.content);
      if (!content) {
        continue;
      }

      if (message.role === 'user') {
        if (currentUser) {
          entries.push({
            turn: entries.length + 1,
            user: currentUser,
          });
        }
        currentUser = this.truncate(content);
        continue;
      }

      if (message.role === 'assistant' && currentUser) {
        entries.push({
          turn: entries.length + 1,
          user: currentUser,
          assistant: this.truncate(content),
        });
        currentUser = undefined;
      }
    }

    if (currentUser) {
      entries.push({
        turn: entries.length + 1,
        user: currentUser,
      });
    }

    return entries;
  }

  private formatPrompt(entries: SessionMemoryEntry[]): string {
    const lines = ['## Session Memory', '', `Recent turns: ${entries.length}`];

    for (const entry of entries) {
      lines.push(`- Turn ${entry.turn} user: ${entry.user}`);
      if (entry.assistant) {
        lines.push(`  assistant: ${entry.assistant}`);
      }
    }

    return lines.join('\n');
  }

  private normalizeContent(content: Message['content']): string {
    if (typeof content === 'string') {
      return content.trim();
    }

    return JSON.stringify(content).trim();
  }

  private truncate(content: string): string {
    const maxChars = this.options.maxCharsPerMessage ?? 240;
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }

    return `${normalized.slice(0, maxChars)}...`;
  }
}
