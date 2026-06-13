#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import type { AgentLoop } from './agents/AgentLoop';
import { HeadlessRunService, type HeadlessRunFormat } from './headless/HeadlessRunService';
import { ConfigService } from './services/ConfigService';
import type { EventBus } from './services/EventBus';
import type { SessionService } from './services/SessionService';
import { isFirstRun } from './utils/firstRun';
import { runFirstTimeSetup } from './utils/setup';
import { installDebugConsole, installInteractiveConsoleSilencer } from './utils/debugConsole';
import * as os from 'node:os';
import { writeDebugLog } from './utils/debugConsole';

const program = new Command();

program.name('codemate').description('AI-powered CLI assistant').version('1.0.12');
installDebugConsole({
  logFile: process.env.CODEMATE_DEBUG_LOG_FILE || '.codemate-debug.log',
});

// Windows 用户提示
if (os.platform() === 'win32') {
  console.log('ℹ️  Windows 用户提示：');
  console.log('   - 建议安装 Git Bash 以获得更好的命令行体验');
  console.log('   - 或使用 WSL2 (Windows Subsystem for Linux)');
  console.log('   - 部分 Unix 命令会自动转换为 Windows 命令\n');
}

// 交互模式（默认）
program
  .command('chat', { isDefault: true })
  .description('Start interactive chat mode')
  .action(async () => {
    try {
      // 检查是否首次运行
      if (isFirstRun()) {
        console.log('\n欢迎使用 CodeMate AI! 🎉\n');
        console.log('检测到这是首次运行，需要进行初始配置。\n');

        // 运行配置向导
        await runFirstTimeSetup();

        console.log('\n✅ 配置完成！\n');
        console.log('现在启动交互式界面...\n');
        // 不要 return，继续启动应用
      }

      const restoreConsole = installInteractiveConsoleSilencer({
        enabled: true,
      });

      // 1. 创建配置服务（使用增强版）
      const configService = new ConfigService({
        cwd: process.cwd(),
        productName: 'codemate',
        argvConfig: {}, // 可以从命令行参数解析
      });

      // 2. 创建应用
      const { Application } = await import('./application/Application');
      const app = new Application(undefined, configService);

      // 3. 启动应用
      await app.start();

      // 4. 初始化 SessionService
      const sessionService = app.getContainer().get<SessionService>('session');
      await sessionService.initialize();
      writeDebugLog('[cli] SessionService initialized');

      // 5. 渲染 Ink UI
      writeDebugLog('[cli] Starting interactive UI');
      const React = await import('react');
      const { render } = await import('ink');
      const { App } = await import('./ui/App');
      const { createInkRenderOptions } = await import('./ui/InkRenderOptions');
      const inkApp = render(React.createElement(App, { app }), createInkRenderOptions());
      installInteractiveConsoleSilencer({
        enabled: true,
      });
      await inkApp.waitUntilExit();
      restoreConsole();
      process.exit(0);
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  });

// 配置命令
program
  .command('config')
  .description('Configure or reconfigure CodeMate AI')
  .argument('[action]', 'doctor | import-env | setup')
  .argument('[provider]', 'provider id for import-env')
  .option('-g, --global', 'write imported provider to global config')
  .action(async (action: string | undefined, provider: string | undefined, options) => {
    try {
      if (action === 'doctor' || action === 'import-env') {
        const configService = new ConfigService({
          cwd: process.cwd(),
          productName: 'codemate',
          argvConfig: {},
        });

        if (action === 'doctor') {
          console.log(configService.formatModelDoctorReport());
          return;
        }

        console.log(configService.importDiscoveredProvider(provider, Boolean(options.global)));
        return;
      }

      console.log('\n🔧 CodeMate AI 配置向导\n');

      if (!isFirstRun()) {
        console.log('当前配置文件: ~/.codemate/config.json');
        console.log('此操作将覆盖现有配置。\n');
      }

      await runFirstTimeSetup();

      console.log('\n✅ 配置已更新！\n');
      console.log('现在可以使用 codemate 开始工作了。\n');
    } catch (error) {
      console.error('❌ 配置失败:', error);
      process.exit(1);
    }
  });

// 非交互模式：给 CI、脚本和外部调度器使用。
program
  .command('run')
  .description('Run one coding-agent task without the interactive UI')
  .argument('[message...]', 'Task message to send to the agent')
  .option('--json', 'Write one final JSON object to stdout')
  .option('--stream-json', 'Write newline-delimited JSON lifecycle events to stdout')
  .option('--timeout <ms>', 'Cancel the run after the given timeout in milliseconds')
  .action(async (messageParts: string[], options) => {
    const restoreConsole = installInteractiveConsoleSilencer({
      enabled: true,
      methods: ['log', 'debug', 'info'],
    });

    try {
      const message = messageParts.join(' ').trim();
      if (!message) {
        process.stdout.write(
          `${JSON.stringify({
            schemaVersion: 1,
            runId: 'headless-run-input-error',
            status: 'failed',
            success: false,
            assistantMessage: 'Error: Missing headless run message.',
            changedFiles: [],
            error: 'Missing headless run message.',
          })}\n`
        );
        process.exitCode = 1;
        return;
      }

      if (isFirstRun()) {
        process.stdout.write(
          `${JSON.stringify({
            schemaVersion: 1,
            runId: 'headless-run-config-error',
            status: 'failed',
            success: false,
            assistantMessage: 'Error: CodeMate is not configured. Run `codemate config` first.',
            changedFiles: [],
            error: 'CodeMate is not configured. Run `codemate config` first.',
          })}\n`
        );
        process.exitCode = 1;
        return;
      }

      const configService = new ConfigService({
        cwd: process.cwd(),
        productName: 'codemate',
        argvConfig: {},
      });
      const { Application } = await import('./application/Application');
      const app = new Application(undefined, configService);
      await app.start();

      const agentLoop = app.getContainer().get<AgentLoop>('agentLoop');
      const eventBus = app.getContainer().get<EventBus>('eventBus');
      const format: HeadlessRunFormat = options.streamJson ? 'stream-json' : 'json';
      const timeoutMs =
        options.timeout === undefined ? undefined : Number.parseInt(options.timeout, 10);

      const service = new HeadlessRunService({
        agentLoop,
        eventBus,
      });
      const result = await service.run({
        message,
        format,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      });

      process.exitCode = result.exitCode;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown headless run error';
      process.stdout.write(
        `${JSON.stringify({
          schemaVersion: 1,
          runId: 'headless-run-fatal-error',
          status: 'failed',
          success: false,
          assistantMessage: `Error: ${message}`,
          changedFiles: [],
          error: message,
        })}\n`
      );
      process.exitCode = 1;
    } finally {
      restoreConsole();
    }
  });

// 服务器模式
program
  .command('server')
  .description('Start HTTP server mode')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(async (options) => {
    try {
      // 检查是否首次运行
      if (isFirstRun()) {
        console.log('\n❌ 错误：尚未配置 CodeMate AI\n');
        console.log('请先运行以下命令进行配置：\n');
        console.log('  codemate config\n');
        process.exit(1);
      }

      // 1. 创建配置服务（使用增强版）
      const configService = new ConfigService({
        cwd: process.cwd(),
        productName: 'codemate',
        argvConfig: {},
      });

      // 2. 创建应用
      const { Application } = await import('./application/Application');
      const app = new Application(undefined, configService);

      // 3. 启动服务器
      const port = Number.parseInt(options.port, 10);
      await app.startServer(port);

      // 4. 优雅退出
      process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down server...');
        await app.stopServer();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  });

program.parse();
