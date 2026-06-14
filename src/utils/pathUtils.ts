import * as path from 'pathe';
import * as os from 'node:os';

/**
 * 规范化路径（跨平台）
 */
export function normalizePath(filePath: string): string {
  // pathe 会自动处理，但我们可以添加额外的规范化
  return path.normalize(filePath);
}

/**
 * 解析相对路径为绝对路径
 */
export function resolvePath(filePath: string, basePath?: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(basePath || process.cwd(), filePath);
}

/**
 * 获取用户主目录
 */
export function getHomeDir(): string {
  return os.homedir();
}

/**
 * 将路径转换为 POSIX 格式（统一使用 /）
 */
export function toPosixPath(filePath: string): string {
  // pathe 默认就是 POSIX 格式
  return filePath.split(path.sep).join('/');
}

/**
 * 检查路径是否在工作目录内（安全检查）
 */
export function isPathInWorkDir(filePath: string, workDir: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const resolvedWorkDir = path.resolve(workDir);
  return resolvedPath.startsWith(resolvedWorkDir);
}
