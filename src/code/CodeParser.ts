import { parse } from '@babel/parser';
import type { File } from '@babel/types';

/**
 * CodeParser - 代码解析器
 *
 * 功能：
 * 1. 解析 JavaScript/TypeScript 代码
 * 2. 生成 AST
 * 3. 支持最新语法
 */
export class CodeParser {
  /**
   * 解析代码
   *
   * @param code 源代码
   * @param filePath 文件路径（用于判断文件类型）
   * @returns AST
   */
  parse(code: string, filePath: string): File {
    const isTypeScript =
      filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.mts');

    try {
      return parse(code, {
        sourceType: 'module',
        plugins: [
          // TypeScript
          ...(isTypeScript ? ['typescript' as const] : []),
          // JSX
          'jsx',
          // 装饰器
          'decorators-legacy',
          // 类属性
          'classProperties',
          // 可选链
          'optionalChaining',
          // 空值合并
          'nullishCoalescingOperator',
        ],
      });
    } catch (error) {
      throw new Error(
        `Failed to parse code: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 验证代码语法
   *
   * @param code 源代码
   * @param filePath 文件路径
   * @returns 是否有效
   */
  validate(code: string, filePath: string): boolean {
    try {
      this.parse(code, filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}
