/**
 * 终端工具函数
 */

/**
 * 清屏函数 - 避免重新渲染导致的闪烁
 */
export function clearTerminal() {
  // 使用ANSI转义序列清屏
  process.stdout.write('\x1b[2J\x1b[0f');
}
