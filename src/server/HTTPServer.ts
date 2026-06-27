import express, { type Express, type Request, type Response } from 'express';
import { createServer, type Server } from 'node:http';
import * as path from 'pathe';
import type { Application } from '../application/Application';
import type { SessionService } from '../services/SessionService';
import type { ConfigService } from '../services/ConfigService';
import type { ToolManager } from '../managers/ToolManager';

/**
 * HTTP 服务器
 *
 * 职责：
 * 1. 提供 RESTful API
 * 2. 提供静态文件服务
 * 3. 集成 WebSocket
 */
export class HTTPServer {
  private app: Express;
  private server: Server | null = null;
  private application: Application;
  private port: number;

  constructor(application: Application, port = 3000) {
    this.application = application;
    this.port = port;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // JSON 解析
    this.app.use(express.json());

    // CORS
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // 静态文件
    const webDir = path.join(__dirname, '../../web');
    this.app.use(express.static(webDir));
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    // API 路由
    this.app.use('/api', this.createAPIRouter());

    // 默认路由（返回 index.html）
    this.app.get('*', (_req, res) => {
      const indexPath = path.join(__dirname, '../../web/index.html');
      res.sendFile(indexPath);
    });
  }

  /**
   * 创建 API 路由
   */
  private createAPIRouter(): express.Router {
    const router = express.Router();

    // 会话管理
    router.get('/sessions', this.getSessions.bind(this));
    router.post('/sessions', this.createSession.bind(this));
    router.get('/sessions/:id', this.getSession.bind(this));
    router.delete('/sessions/:id', this.deleteSession.bind(this));

    // 消息管理
    router.get('/sessions/:id/messages', this.getMessages.bind(this));
    router.post('/sessions/:id/messages', this.sendMessage.bind(this));

    // 配置管理
    router.get('/config', this.getConfig.bind(this));
    router.put('/config', this.updateConfig.bind(this));

    // 工具管理
    router.get('/tools', this.getTools.bind(this));

    return router;
  }

  /**
   * 获取所有会话
   */
  private async getSessions(_req: Request, res: Response): Promise<void> {
    try {
      const sessionService = this.application.getContainer().get<SessionService>('sessionService');
      const sessions = sessionService.list();

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 创建新会话
   */
  private async createSession(req: Request, res: Response): Promise<void> {
    try {
      const { summary } = req.body;
      const sessionService = this.application.getContainer().get<SessionService>('sessionService');
      const session = await sessionService.create(summary);

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 获取会话详情
   */
  private async getSession(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sessionService = this.application.getContainer().get<SessionService>('sessionService');
      const session = await sessionService.load(id);

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 删除会话
   */
  private async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sessionService = this.application.getContainer().get<SessionService>('sessionService');
      await sessionService.delete(id);

      res.json({
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 获取会话消息
   */
  private async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sessionService = this.application.getContainer().get<SessionService>('sessionService');
      const session = await sessionService.load(id);

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      res.json({
        success: true,
        data: session.messages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 发送消息（通过 WebSocket 处理）
   */
  private async sendMessage(_req: Request, res: Response): Promise<void> {
    res.status(400).json({
      success: false,
      error: 'Please use WebSocket for real-time messaging',
    });
  }

  /**
   * 获取配置
   */
  private async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      const configService = this.application.getContainer().get<ConfigService>('configService');
      const config = configService.getConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 更新配置
   */
  private async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const configService = this.application.getContainer().get<ConfigService>('configService');
      const updates = req.body;

      configService.updateConfig(false, updates);

      res.json({
        success: true,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 获取可用工具
   */
  private async getTools(_req: Request, res: Response): Promise<void> {
    try {
      const toolManager = this.application.getContainer().get<ToolManager>('toolManager');
      const toolsInfo = toolManager.getAllInfo();

      res.json({
        success: true,
        data: toolsInfo,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer(this.app);

      this.server.listen(this.port, () => {
        console.log(`🌐 HTTP Server running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🌐 HTTP Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * 获取 HTTP Server 实例（用于 WebSocket）
   */
  getServer(): Server | null {
    return this.server;
  }
}
