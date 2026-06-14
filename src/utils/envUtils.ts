import * as os from 'node:os';

/**
 * 获取 PATH 分隔符
 */
export function getPathSeparator(): string {
  return os.platform() === 'win32' ? ';' : ':';
}

/**
 * 解析 PATH 环境变量
 */
export function parsePath(pathEnv: string = process.env.PATH || ''): string[] {
  const separator = getPathSeparator();
  return pathEnv.split(separator).filter(Boolean);
}

/**
 * 添加路径到 PATH
 */
export function addToPath(newPath: string): string {
  const paths = parsePath();
  const separator = getPathSeparator();

  if (!paths.includes(newPath)) {
    paths.unshift(newPath);
  }

  return paths.join(separator);
}

/**
 * 获取环境变量（跨平台）
 */
export function getEnv(name: string): string | undefined {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: 不区分大小写
    const upperName = name.toUpperCase();
    return process.env[upperName] || process.env[name];
  }

  // Unix-like: 区分大小写
  return process.env[name];
}
