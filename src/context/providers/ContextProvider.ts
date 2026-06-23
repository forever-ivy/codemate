import type { ContextProvider as IContextProvider } from '../../types/index';

/**
 * ContextProvider 基类
 *
 * 提供通用的功能，子类只需实现 resolve 方法
 */
export abstract class ContextProvider implements IContextProvider {
  abstract name: string;
  abstract pattern: RegExp;
  abstract ttl: number;

  /**
   * 解析上下文
   *
   * 子类必须实现此方法
   */
  abstract resolve(match: RegExpMatchArray, cwd: string): Promise<string>;

  /**
   * 生成缓存键
   *
   * 默认使用 Provider 名称作为缓存键
   * 子类可以覆盖此方法以支持更复杂的缓存策略
   *
   * @param _match 正则匹配结果
   * @returns 缓存键
   */
  getCacheKey(_match: RegExpMatchArray): string {
    return this.name;
  }

  /**
   * 格式化为 Markdown 代码块
   *
   * @param content 内容
   * @param language 语言（用于语法高亮）
   * @returns Markdown 代码块
   */
  protected formatCodeBlock(content: string, language = ''): string {
    return `\`\`\`${language}\n${content}\n\`\`\``;
  }

  /**
   * 格式化为 Markdown 标题
   *
   * @param title 标题
   * @param level 级别（1-6）
   * @returns Markdown 标题
   */
  protected formatHeading(title: string, level = 2): string {
    return `${'#'.repeat(level)} ${title}\n`;
  }

  /**
   * 格式化为 Markdown 列表
   *
   * @param items 列表项
   * @returns Markdown 列表
   */
  protected formatList(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
  }
}
