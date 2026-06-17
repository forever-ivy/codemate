import { readFile } from 'fs/promises';

export class LogParser {
  async parseLogFile(sessionPath: string): Promise<LogData> {
    const sessionFile = sessionPath;
    const requestFile = sessionPath.replace('.jsonl', '.requests.jsonl');

    // 解析会话消息
    const messages = await this.parseMessages(sessionFile);

    // 解析请求日志（可选）
    let requests: RequestLog[] = [];
    try {
      requests = await this.parseRequests(requestFile);
    } catch (error) {
      // 请求日志文件可能不存在，这是正常的
    }

    // 过滤活跃消息
    const activeMessages = this.filterActiveMessages(messages);

    return {
      sessionPath,
      messages: activeMessages,
      requests,
      totalMessages: messages.length,
      activeMessages: activeMessages.length,
    };
  }

  async parseMessages(filePath: string): Promise<Message[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const messages: Message[] = [];

      for (let i = 0; i < lines.length; i++) {
        try {
          const message = JSON.parse(lines[i]);

          // 基本类型验证
          if (this.isValidMessage(message)) {
            messages.push(message);
          } else {
            console.warn(`第 ${i + 1} 行消息格式无效`);
          }
        } catch (error) {
          console.warn(
            `第 ${i + 1} 行 JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return messages;
    } catch (error) {
      throw new Error(
        `读取会话文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async parseRequests(filePath: string): Promise<RequestLog[]> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const requests: RequestLog[] = [];

      for (let i = 0; i < lines.length; i++) {
        try {
          const request = JSON.parse(lines[i]);
          if (this.isValidRequest(request)) {
            requests.push(request);
          }
        } catch (error) {
          console.warn(
            `第 ${i + 1} 行请求解析失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return requests;
    } catch (error) {
      throw new Error(
        `读取请求文件失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private filterActiveMessages(messages: Message[]): Message[] {
    if (messages.length === 0) return [];

    // 构建消息映射和子消息映射
    const messageMap = new Map<string, Message>();
    const childrenMap = new Map<string, string[]>();

    messages.forEach((msg) => {
      messageMap.set(msg.uuid, msg);

      if (msg.parentUuid) {
        if (!childrenMap.has(msg.parentUuid)) {
          childrenMap.set(msg.parentUuid, []);
        }
        childrenMap.get(msg.parentUuid)!.push(msg.uuid);
      }
    });

    // 找到叶子节点（没有子消息的消息）
    const leafMessages = messages.filter((msg) => !childrenMap.has(msg.uuid));

    if (leafMessages.length === 0) {
      // 如果没有叶子节点，使用最后一条消息
      return [messages[messages.length - 1]];
    }

    // 使用最后一个叶子节点作为起点
    const lastLeaf = leafMessages[leafMessages.length - 1];

    // 向上追溯构建活跃路径
    const activeMessages: Message[] = [];
    const visited = new Set<string>();
    let current: Message | undefined = lastLeaf;

    while (current && !visited.has(current.uuid)) {
      visited.add(current.uuid);
      activeMessages.unshift(current);
      current = current.parentUuid ? messageMap.get(current.parentUuid) : undefined;
    }

    return activeMessages;
  }

  private isValidMessage(obj: any): obj is Message {
    return (
      obj &&
      typeof obj.role === 'string' &&
      ['user', 'assistant', 'tool'].includes(obj.role) &&
      typeof obj.uuid === 'string' &&
      typeof obj.timestamp === 'number' &&
      obj.content !== undefined
    );
  }

  private isValidRequest(obj: any): obj is RequestLog {
    return obj && typeof obj.uuid === 'string' && typeof obj.model === 'string';
  }
}

export interface LogData {
  sessionPath: string;
  messages: Message[];
  requests: RequestLog[];
  totalMessages: number;
  activeMessages: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ToolCall[];
  uuid: string;
  parentUuid?: string;
  timestamp: number;
}

export interface RequestLog {
  uuid: string;
  model: string;
  tools?: string[];
  request?: any;
  response?: any;
  chunks?: any[];
}

export interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}
