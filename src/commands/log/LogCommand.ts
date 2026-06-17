import { SlashCommand } from '../base/SlashCommand.js';
import { Container } from '../../application/Container.js';
import { Paths } from '../../services/Paths.js';
import { render } from 'ink';
import React from 'react';
import { SessionSelector } from './SessionSelector.js';
import { LogParser } from './LogParser.js';
import { HTMLGenerator } from './HTMLGenerator.js';
import { FileOpener } from './FileOpener.js';
import { readdir, stat } from 'fs/promises';
import * as pathe from 'pathe';

export class LogCommand extends SlashCommand {
  name = 'log';
  description = '查看会话日志（HTML格式）';

  constructor(private container: Container) {
    super();
  }

  async execute(args: string[]): Promise<void> {
    // 如果提供了文件路径，直接打开
    if (args.length > 0) {
      const filePath = args[0];
      await this.openLogFile(filePath);
      return;
    }

    // 否则显示会话选择 UI
    await this.showSessionSelector();
  }

  private async openLogFile(filePath: string): Promise<void> {
    try {
      // 解析日志文件
      const parser = new LogParser();
      const logData = await parser.parseLogFile(filePath);

      // 生成 HTML
      const generator = new HTMLGenerator();
      const htmlPath = await generator.generateHTML(logData);

      // 打开文件
      const opener = new FileOpener();
      await opener.openFile(htmlPath);

      console.log(`日志已在浏览器中打开: ${htmlPath}`);
    } catch (error) {
      console.error('打开日志文件失败:', error instanceof Error ? error.message : String(error));
    }
  }

  private async showSessionSelector(): Promise<void> {
    try {
      const paths = this.container.get<Paths>('paths');

      // 获取所有会话
      const sessions = await this.getAllSessions(paths);

      if (sessions.length === 0) {
        console.log('没有找到会话文件');
        return;
      }

      // 显示选择 UI
      const selectedSession = await this.renderSessionSelector(sessions);

      if (selectedSession) {
        await this.openLogFile(selectedSession.path);
      }
    } catch (error) {
      console.error('显示会话选择器失败:', error instanceof Error ? error.message : String(error));
    }
  }

  private async getAllSessions(paths: Paths): Promise<SessionInfo[]> {
    const sessionsDir = paths.globalProjectDir; // 使用 globalProjectDir
    const sessions: SessionInfo[] = [];

    try {
      const files = await readdir(sessionsDir);

      for (const file of files) {
        if (file.endsWith('.jsonl') && !file.endsWith('.requests.jsonl')) {
          const filePath = pathe.join(sessionsDir, file);
          const sessionInfo = await this.getSessionInfo(filePath);
          if (sessionInfo) {
            sessions.push(sessionInfo);
          }
        }
      }

      // 按最后修改时间排序（最新的在前）
      sessions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      return sessions;
    } catch (error) {
      throw new Error(
        `扫描会话目录失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getSessionInfo(filePath: string): Promise<SessionInfo | null> {
    try {
      const stats = await stat(filePath);
      const parser = new LogParser();

      // 快速解析获取基本信息
      const messages = await parser.parseMessages(filePath);

      // 生成会话名称（使用第一条用户消息的前50个字符）
      const firstUserMessage = messages.find((m) => m.role === 'user');
      let name = pathe.basename(filePath, '.jsonl');

      if (firstUserMessage && typeof firstUserMessage.content === 'string') {
        const preview = firstUserMessage.content.slice(0, 50);
        name = preview + (firstUserMessage.content.length > 50 ? '...' : '');
      }

      return {
        id: pathe.basename(filePath, '.jsonl'),
        name,
        path: filePath,
        lastModified: stats.mtime,
        messageCount: messages.length,
      };
    } catch (error) {
      console.warn(
        `获取会话信息失败: ${filePath}`,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async renderSessionSelector(sessions: SessionInfo[]): Promise<SessionInfo | null> {
    return new Promise((resolve) => {
      const { unmount } = render(
        React.createElement(SessionSelector, {
          sessions,
          onSelect: (session: SessionInfo) => {
            unmount();
            resolve(session);
          },
          onCancel: () => {
            unmount();
            resolve(null);
          },
        })
      );
    });
  }
}

export interface SessionInfo {
  id: string;
  name: string;
  path: string;
  lastModified: Date;
  messageCount: number;
}
