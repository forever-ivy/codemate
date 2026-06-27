import { WebSocketServer as WSServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { Application } from '../application/Application';
import type { SessionService } from '../services/SessionService';
import type { AgentLoop } from '../agents/AgentLoop';

/**
 * WebSocket 消息类型
 */
interface WSMessage {
  type: 'message' | 'tool_call' | 'tool_result' | 'done' | 'error';
  sessionId?: string;
  content?: string;
  role?: string;
  tool?: string;
  args?: any;
  result?: any;
  error?: string;
}

/**
 * WebSocket 服务器
 *
 * 职责：
 * 1. 处理实时消息
 * 2. 流式返回 AI 响应
 * 3. 实时推送工具调用状态
 */
export class WebSocketServer {
  private wss: WSServer;
  private application: Application;
  private clients = new Map<string, WebSocket>();

  constructor(httpServer: Server, application: Application) {
    this.application = application;
    this.wss = new WSServer({ server: httpServer });

    this.setupWebSocket();
  }

  /**
   * 设置 WebSocket
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 WebSocket client connected');

      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      // 发送欢迎消息
      this.send(ws, {
        type: 'connected',
        clientId,
      });

      // 处理消息
      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          this.send(ws, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // 处理断开
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(clientId);
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  /**
   * 处理消息
   */
  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const { type, sessionId, content } = message;

    if (type === 'message' && sessionId && content) {
      await this.handleChatMessage(ws, sessionId, content);
    }
  }

  /**
   * 处理聊天消息
   */
  private async handleChatMessage(
    ws: WebSocket,
    sessionId: string,
    content: string
  ): Promise<void> {
    try {
      const sessionService = this.application.getContainer().get<SessionService>('session');
      const agentLoop = this.application.getContainer().get<AgentLoop>('agentLoop');

      // 加载会话
      const session = await sessionService.load(sessionId);
      if (!session) {
        this.send(ws, {
          type: 'error',
          error: 'Session not found',
        });
        return;
      }

      // 发送用户消息确认
      this.send(ws, {
        type: 'message',
        role: 'user',
        content,
      });

      const result = await agentLoop.execute(content);

      // 发送 AI 响应
      this.send(ws, {
        type: 'message',
        role: 'assistant',
        content: result.response?.content || `❌ Error: ${result.error || 'Unknown error'}`,
      });

      // 发送完成消息
      this.send(ws, {
        type: 'done',
        sessionId,
      });
    } catch (error) {
      this.send(ws, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 发送消息
   */
  private send(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 广播消息
   */
  broadcast(message: any): void {
    const data = JSON.stringify(message);

    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * 生成客户端 ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 关闭服务器
   */
  close(): void {
    this.wss.close();
    console.log('🔌 WebSocket server closed');
  }
}
