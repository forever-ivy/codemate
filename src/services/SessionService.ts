import * as fs from 'node:fs/promises';
import { EventType } from '../types/index';
import type { EventBus } from './EventBus';
import type {
  Session,
  SessionConfig,
  LogEntry,
  Message,
  EnhancedMessage,
  ForkOptions,
} from '../types/index';
import type { Paths } from './Paths';
import { filterMessages, cleanUnmatchedToolUse, generateMessageUuid } from '../utils/messageTree';

/**
 * SessionService - 会话服务（企业级实现）
 *
 * 职责：
 * 1. 创建和管理会话
 * 2. 使用 .jsonl 格式存储
 * 3. 支持会话摘要
 * 4. 管理当前活动会话
 *
 */
export class SessionService {
  private paths: Paths;
  private eventBus: EventBus; // 新增
  private currentSession: Session | null = null;

  /**
   * 构造函数
   *
   * @param paths Paths 实例
   */
  constructor(paths: Paths, eventBus: EventBus) {
    this.paths = paths;
    this.eventBus = eventBus; // 新增
    console.log('✅ SessionService initialized');
  }

  /**
   * 初始化会话目录
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.paths.globalProjectDir, { recursive: true });
      console.log(`📁 Session directory ready: ${this.paths.globalProjectDir}`);
    } catch (error) {
      console.error('❌ Failed to create session directory:', error);
      throw new Error('Failed to initialize session directory');
    }
  }

  /**
   * 创建新会话
   *
   * @param summary 会话摘要（可选）
   * @returns 新创建的会话
   */
  async create(summary?: string): Promise<Session> {
    const sessionId = `session-${Date.now()}`;
    console.log(`📝 Creating new session: ${sessionId}`);

    const config: SessionConfig = {
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const session: Session = {
      id: sessionId,
      messages: [],
      config,
    };

    // 写入配置行
    await this.appendLogEntry(sessionId, {
      type: 'config',
      config,
    });

    this.currentSession = session;
    console.log(`✅ Session created: ${sessionId}`);

    // 🔥 发出事件
    this.eventBus.emit(EventType.SESSION_CREATED, {
      session,
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * 加载会话
   *
   * @param sessionId 会话 ID
   * @returns 加载的会话
   */
  async load(sessionId: string): Promise<Session> {
    console.log(`📂 Loading session: ${sessionId}`);

    const logPath = this.paths.getSessionLogPath(sessionId);
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    let config: SessionConfig | undefined;
    const messages: Message[] = [];

    for (const line of lines) {
      const entry: LogEntry = JSON.parse(line);

      if (entry.type === 'config') {
        config = entry.config;
      } else if (entry.type === 'message') {
        messages.push({
          role: entry.role,
          content: entry.content,
        });
      }
    }

    const session: Session = {
      id: sessionId,
      messages,
      config,
    };

    this.currentSession = session;

    console.log(`✅ Session loaded: ${sessionId} (${messages.length} messages)`);

    // 🔥 发出事件
    this.eventBus.emit(EventType.SESSION_LOADED, {
      session,
      timestamp: Date.now(),
    });
    return session;
  }

  /**
   * 添加消息到当前会话
   *
   * @param message 消息
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // 将普通消息转换为增强消息
    const enhancedMessage: EnhancedMessage = {
      uuid: generateMessageUuid(),
      parentUuid: null,
      role: message.role,
      content: message.content,
      timestamp: Date.now(),
    };

    // 确保 messages 数组是 EnhancedMessage 类型
    (this.currentSession.messages as EnhancedMessage[]).push(enhancedMessage);

    // 追加到 .jsonl 文件
    await this.appendLogEntry(this.currentSession.id, {
      type: 'message',
      role: enhancedMessage.role,
      content: enhancedMessage.content,
      uuid: enhancedMessage.uuid,
      parentUuid: enhancedMessage.parentUuid,
      timestamp: enhancedMessage.timestamp,
    } as any);

    // 🔥 发出事件
    this.eventBus.emit(EventType.MESSAGE_SENT, {
      message: {
        role: enhancedMessage.role,
        content:
          typeof enhancedMessage.content === 'string'
            ? enhancedMessage.content
            : JSON.stringify(enhancedMessage.content),
      },
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
    });
    // 更新配置的 updatedAt
    if (this.currentSession.config) {
      this.currentSession.config.updatedAt = new Date().toISOString();
    }

    // 🔥 发出保存事件
    this.eventBus.emit(EventType.SESSION_SAVED, {
      session: this.currentSession,
      timestamp: Date.now(),
    });
  }

  /**
   * 更新会话的消息列表（用于回退功能）
   *
   * @param sessionId 会话ID
   * @param messages 新的消息列表
   */
  async updateSessionMessages(sessionId: string, messages: Message[]): Promise<void> {
    if (!this.currentSession || this.currentSession.id !== sessionId) {
      throw new Error(`Session ${sessionId} is not the current active session`);
    }

    // 更新内存中的会话消息
    this.currentSession.messages = messages as EnhancedMessage[];

    // 更新配置的 updatedAt
    if (this.currentSession.config) {
      this.currentSession.config.updatedAt = new Date().toISOString();
    }

    // 重写整个 .jsonl 文件
    await this.rewriteSessionFile(sessionId, messages as EnhancedMessage[]);

    // 🔥 发出会话更新事件
    this.eventBus.emit('session_updated', {
      sessionId,
      messages: messages.length,
      timestamp: Date.now(),
    });

    console.log(`✅ Session ${sessionId} messages updated (${messages.length} messages)`);
  }

  /**
   * 重写会话文件（用于消息截断）
   *
   * @param sessionId 会话ID
   * @param messages 消息列表
   */
  private async rewriteSessionFile(sessionId: string, messages: EnhancedMessage[]): Promise<void> {
    const sessionPath = this.paths.getSessionLogPath(sessionId);

    // 创建新的日志条目
    const logEntries: string[] = [];

    // 添加会话配置条目
    if (this.currentSession?.config) {
      logEntries.push(
        JSON.stringify({
          type: 'config',
          ...this.currentSession.config,
          timestamp: Date.now(),
        })
      );
    }

    // 添加所有消息条目
    for (const message of messages) {
      logEntries.push(
        JSON.stringify({
          type: 'message',
          role: message.role,
          content: message.content,
          uuid: message.uuid,
          parentUuid: message.parentUuid,
          timestamp: message.timestamp,
        })
      );
    }

    // 写入文件
    await fs.writeFile(sessionPath, logEntries.join('\n') + '\n', 'utf-8');
  }

  /**
   * 获取会话的消息数量
   *
   * @param sessionId 会话ID
   * @returns 消息数量
   */
  getSessionMessageCount(sessionId?: string): number {
    const targetSessionId = sessionId || this.currentSession?.id;
    if (!targetSessionId || !this.currentSession || this.currentSession.id !== targetSessionId) {
      return 0;
    }
    return this.currentSession.messages.length;
  }

  /**
   * 列出所有会话
   *
   * @returns 会话元数据列表
   */
  list() {
    return this.paths.getAllSessions();
  }

  /**
   * 删除会话
   *
   * @param sessionId 会话 ID
   */
  async delete(sessionId: string): Promise<void> {
    const logPath = this.paths.getSessionLogPath(sessionId);
    // 加载会话以便发出事件
    let session: Session | null = null;
    try {
      session = await this.load(sessionId);
    } catch {
      // 忽略加载错误
    }

    await fs.unlink(logPath);

    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }

    console.log(`✅ Session deleted: ${sessionId}`);
    // 🔥 发出事件
    if (session) {
      this.eventBus.emit(EventType.SESSION_DELETED, {
        session,
        timestamp: Date.now(),
      });
    }
  }
  /**
   * 清除当前会话并创建新会话
   */
  async clear(): Promise<{ sessionId: string }> {
    // 创建新会话
    const newSession = await this.create();

    return {
      sessionId: newSession.id,
    };
  }

  /**
   * 获取当前会话的消息列表
   */
  getMessages(): Message[] {
    if (!this.currentSession) {
      return [];
    }
    return this.currentSession.messages.map((message) => {
      const enhanced = message as EnhancedMessage;
      if (typeof enhanced.uuid === 'string') {
        const content =
          typeof enhanced.content === 'string'
            ? enhanced.content
            : JSON.stringify(enhanced.content);
        return {
          role: enhanced.role,
          content,
        };
      }
      return message as Message;
    });
  }

  /**
   * 清空当前会话的消息列表
   * 注意：这只清空内存中的消息，不会重写文件
   */
  clearMessages(): void {
    if (!this.currentSession) {
      return;
    }
    this.currentSession.messages = [];
  }

  /**
   * 获取当前会话
   */
  getCurrent(): Session | null {
    return this.currentSession;
  }

  /**
   * 设置当前会话
   */
  setCurrent(session: Session): void {
    this.currentSession = session;
  }

  /**
   * 创建会话分支
   *
   * @param options 分叉选项
   * @returns 新创建的会话
   */
  async fork(options: ForkOptions): Promise<Session> {
    if (!this.currentSession) {
      throw new Error('No active session to fork from');
    }

    const { fromMessageUuid, newMessage } = options;

    // 1. 获取当前会话的所有消息
    const allMessages = this.currentSession.messages as EnhancedMessage[];

    // 2. 过滤到分叉点的消息
    let forkedMessages = filterMessages(allMessages, fromMessageUuid);

    // 3. 清理未匹配的 tool_use
    forkedMessages = cleanUnmatchedToolUse(forkedMessages);

    // 4. 添加新消息（如果有）
    if (newMessage) {
      const enhancedNewMessage: EnhancedMessage = {
        ...newMessage,
        uuid: generateMessageUuid(),
        parentUuid: fromMessageUuid,
        timestamp: Date.now(),
      };
      forkedMessages.push(enhancedNewMessage);
    }

    // 5. 创建新会话
    const summary = `Fork from ${this.currentSession.id}`;
    const newSession = await this.create(summary);

    // 6. 添加分叉的消息
    for (const message of forkedMessages) {
      await this.appendLogEntry(newSession.id, {
        type: 'message',
        role: message.role,
        content: message.content,
        uuid: message.uuid,
        parentUuid: message.parentUuid,
        timestamp: message.timestamp,
      } as any);
    }

    // 7. 更新会话配置
    if (newSession.config) {
      newSession.config.activeMessageUuid = forkedMessages[forkedMessages.length - 1]?.uuid;
    }

    newSession.messages = forkedMessages;

    console.log(`✅ Session forked: ${newSession.id}`);

    // 8. 发出事件
    this.eventBus.emit(EventType.SESSION_CREATED, {
      session: newSession,
      timestamp: Date.now(),
    });

    return newSession;
  }

  /**
   * 获取活跃消息
   *
   * @returns 活跃路径上的消息
   */
  getActiveMessages(): EnhancedMessage[] {
    if (!this.currentSession) {
      return [];
    }

    const messages = this.currentSession.messages as EnhancedMessage[];
    const activeUuid = this.currentSession.config?.activeMessageUuid;

    return filterMessages(messages, activeUuid);
  }

  /**
   * 设置活跃消息
   *
   * @param messageUuid 消息 UUID
   */
  async setActiveMessage(messageUuid: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // 更新配置
    if (!this.currentSession.config) {
      this.currentSession.config = {};
    }
    this.currentSession.config.activeMessageUuid = messageUuid;
    this.currentSession.config.updatedAt = new Date().toISOString();

    // 保存配置
    await this.appendLogEntry(this.currentSession.id, {
      type: 'config',
      config: this.currentSession.config,
    });

    console.log(`✅ Active message set: ${messageUuid}`);
  }

  /**
   * 添加消息（增强版）
   *
   * 支持树形结构
   */
  async addEnhancedMessage(message: Omit<EnhancedMessage, 'uuid' | 'timestamp'>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // 生成 UUID 和时间戳
    const enhancedMessage: EnhancedMessage = {
      ...message,
      uuid: generateMessageUuid(),
      timestamp: Date.now(),
    };

    // 添加到会话
    (this.currentSession.messages as EnhancedMessage[]).push(enhancedMessage);

    // 追加到 .jsonl 文件
    await this.appendLogEntry(this.currentSession.id, {
      type: 'message',
      role: enhancedMessage.role,
      content: enhancedMessage.content,
      uuid: enhancedMessage.uuid,
      parentUuid: enhancedMessage.parentUuid,
      timestamp: enhancedMessage.timestamp,
    } as any);

    // 更新活跃消息
    if (this.currentSession.config) {
      this.currentSession.config.activeMessageUuid = enhancedMessage.uuid;
      this.currentSession.config.updatedAt = new Date().toISOString();
    }

    console.log(`📨 Enhanced message added: ${enhancedMessage.uuid}`);

    // 发出事件
    this.eventBus.emit(EventType.MESSAGE_SENT, {
      message: {
        role: enhancedMessage.role,
        content:
          typeof enhancedMessage.content === 'string'
            ? enhancedMessage.content
            : JSON.stringify(enhancedMessage.content),
      },
      sessionId: this.currentSession.id,
      timestamp: Date.now(),
    });
  }

  /**
   * 追加日志条目到 .jsonl 文件
   *
   * @param sessionId 会话 ID
   * @param entry 日志条目
   */
  private async appendLogEntry(sessionId: string, entry: LogEntry): Promise<void> {
    const logPath = this.paths.getSessionLogPath(sessionId);
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  }

  /**
   * 恢复指定会话
   * 将指定的会话设置为当前活跃会话
   */
  async resume(sessionId: string): Promise<void> {
    // 1. 验证会话是否存在
    const sessionPath = this.paths.getSessionLogPath(sessionId);
    try {
      await fs.access(sessionPath);
    } catch {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 2. 保存当前会话状态（如果有）
    if (this.currentSession) {
      await this.save();
    }

    // 3. 加载目标会话
    const session = await this.load(sessionId);

    // 4. 发布会话切换事件
    this.eventBus.emit('session:resumed', {
      sessionId,
      messageCount: session.messages.length,
    });
  }

  /**
   * 检查会话是否存在
   */
  async exists(sessionId: string): Promise<boolean> {
    const sessionPath = this.paths.getSessionLogPath(sessionId);
    try {
      await fs.access(sessionPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 保存当前会话
   */
  async save(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // 这里可以添加保存逻辑，如果需要的话
    // 当前实现中消息是实时写入的，所以可能不需要额外保存
  }
}
