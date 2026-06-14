/**
 * 日志系统 - 控制调试输出
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

class Logger {
  private level: LogLevel = 'warn'; // 默认只显示警告和错误，隐藏调试信息

  setLevel(level: LogLevel) {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      silent: 4,
    };
    return levels[level] >= levels[this.level];
  }

  debug(...args: any[]) {
    if (this.shouldLog('debug')) {
      console.log(...args);
    }
  }

  info(...args: any[]) {
    if (this.shouldLog('info')) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(...args);
    }
  }
}

export const logger = new Logger();
