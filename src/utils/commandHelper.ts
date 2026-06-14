import * as os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * 获取跨平台命令建议
 */
export function getCommandSuggestion(command: string): string | null {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows 用户输入了 Unix 命令，提供建议
    const suggestions: Record<string, string> = {
      ls: 'dir (或安装 Git Bash)',
      cat: 'type',
      grep: 'findstr (或安装 Git Bash)',
      rm: 'del',
      cp: 'copy',
      mv: 'move',
      pwd: 'cd',
      clear: 'cls',
      which: 'where',
    };

    const baseCommand = command.split(' ')[0];
    return suggestions[baseCommand] || null;
  }

  return null;
}

/**
 * 检查命令是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  const platform = os.platform();
  const checkCommand = platform === 'win32' ? 'where' : 'which';

  try {
    await execAsync(`${checkCommand} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前平台的 shell
 */
export function getShell(): string {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      // Windows: 优先使用 PowerShell
      return process.env.SHELL || 'powershell.exe';
    case 'darwin':
    case 'linux':
      // macOS/Linux: 使用 bash 或用户默认 shell
      return process.env.SHELL || '/bin/bash';
    default:
      return '/bin/sh';
  }
}

/**
 * 适配命令到当前平台
 */
export function adaptCommand(command: string): string {
  const platform = os.platform();

  if (platform !== 'win32') {
    // Unix-like 系统，直接返回
    return command;
  }

  // Windows: 尝试转换常见的 Unix 命令
  const commandMap: Record<string, string> = {
    ls: 'dir',
    'ls -la': 'dir',
    'ls -l': 'dir',
    cat: 'type',
    rm: 'del',
    'rm -rf': 'rmdir /s /q',
    cp: 'copy',
    mv: 'move',
    pwd: 'cd',
    clear: 'cls',
    which: 'where',
  };

  // 检查是否是需要转换的命令
  for (const [unixCmd, winCmd] of Object.entries(commandMap)) {
    if (command.startsWith(unixCmd)) {
      const adapted = command.replace(unixCmd, winCmd);
      console.log(`  ℹ️  Adapted command for Windows: ${adapted}`);
      return adapted;
    }
  }

  return command;
}
