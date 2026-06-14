import * as os from 'node:os';
import * as fs from 'node:fs/promises';

/**
 * 获取当前平台的行尾符
 */
export function getEOL(): string {
  return os.EOL; // Windows: \r\n, Unix: \n
}

/**
 * 规范化行尾符
 */
export function normalizeEOL(content: string, targetEOL?: string): string {
  const eol = targetEOL || getEOL();
  // 先统一为 \n，再替换为目标行尾符
  return content.replace(/\r\n|\r|\n/g, '\n').replace(/\n/g, eol);
}

/**
 * 转换为 Unix 行尾符（LF）
 */
export function toUnixEOL(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * 转换为 Windows 行尾符（CRLF）
 */
export function toWindowsEOL(content: string): string {
  return content.replace(/\n/g, '\r\n');
}

/**
 * 设置文件权限（跨平台）
 */
export async function setFilePermissions(filePath: string, mode: number): Promise<void> {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: 跳过权限设置
    console.log('  ℹ️  Skipping file permissions on Windows');
    return;
  }

  // Unix-like: 设置权限
  await fs.chmod(filePath, mode);
}

/**
 * 使文件可执行（跨平台）
 */
export async function makeExecutable(filePath: string): Promise<void> {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: 文件扩展名决定是否可执行
    console.log('  ℹ️  On Windows, executability is determined by file extension');
    return;
  }

  // Unix-like: 添加执行权限
  await fs.chmod(filePath, 0o755);
}
