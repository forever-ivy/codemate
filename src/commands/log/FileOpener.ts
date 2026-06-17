import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import * as pathe from 'pathe';

const execAsync = promisify(exec);

export class FileOpener {
  async openFile(filePath: string): Promise<void> {
    const command = await this.getOpenCommand(filePath);

    try {
      await execAsync(command);
    } catch (error) {
      throw new Error(`打开文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getOpenCommand(filePath: string): Promise<string> {
    const currentPlatform = platform();

    // 规范化路径
    const normalizedPath = pathe.resolve(filePath);

    switch (currentPlatform) {
      case 'darwin':
        // macOS: 检查是否有 open 命令
        try {
          await execAsync('which open');
          return `open "${normalizedPath}"`;
        } catch {
          throw new Error('macOS 系统未找到 open 命令');
        }

      case 'win32':
        // Windows: 使用 start 命令
        return `start "" "${normalizedPath}"`;

      case 'linux':
        // Linux: 尝试多个命令
        const linuxCommands = ['xdg-open', 'gnome-open', 'kde-open'];

        for (const cmd of linuxCommands) {
          try {
            await execAsync(`which ${cmd}`);
            return `${cmd} "${normalizedPath}"`;
          } catch {
            // 继续尝试下一个命令
          }
        }

        throw new Error('Linux 系统未找到合适的文件打开命令');

      default:
        throw new Error(`不支持的操作系统: ${currentPlatform}`);
    }
  }
}
