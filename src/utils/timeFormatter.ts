/**
 * 时间格式化工具类
 *
 * 提供各种时间格式化功能，特别是相对时间显示
 */
export class TimeFormatter {
  /**
   * 格式化相对时间
   * 将绝对时间转换为用户友好的相对时间显示
   *
   * @param date 要格式化的日期
   * @returns 相对时间字符串，如 "2h ago", "3 days ago"
   */
  static formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (months > 0) {
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return `${seconds}s ago`;
    }
  }

  /**
   * 格式化绝对时间
   * 将日期格式化为标准的绝对时间显示
   *
   * @param date 要格式化的日期
   * @returns 格式化的绝对时间字符串
   */
  static formatAbsoluteTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 格式化持续时间
   * 将毫秒数转换为可读的持续时间
   *
   * @param milliseconds 毫秒数
   * @returns 格式化的持续时间字符串
   */
  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
