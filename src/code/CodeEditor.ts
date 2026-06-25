import * as fs from 'node:fs/promises';
import generate from '@babel/generator';
import { CodeParser } from './CodeParser';
import { CodeLocator } from './CodeLocator';
import type { CodeElementType, EditResult } from './types';

/**
 * CodeEditor - 代码编辑器
 *
 * 功能：
 * 1. 替换代码元素
 * 2. 保持格式和缩进
 * 3. 验证语法
 */
export class CodeEditor {
  private parser: CodeParser;
  private locator: CodeLocator;

  constructor() {
    this.parser = new CodeParser();
    this.locator = new CodeLocator();
  }

  /**
   * 编辑代码
   *
   * @param filePath 文件路径
   * @param target 目标名称
   * @param targetType 目标类型
   * @param newCode 新代码
   * @param parent 父元素名称（可选）
   * @returns 编辑结果
   */
  async edit(
    filePath: string,
    target: string,
    targetType: CodeElementType,
    newCode: string,
    parent?: string
  ): Promise<EditResult> {
    try {
      // 1. 读取文件
      const oldContent = await fs.readFile(filePath, 'utf-8');

      // 2. 解析代码
      const ast = this.parser.parse(oldContent, filePath);

      // 3. 定位目标
      const element = this.locator.find(ast, target, targetType, parent);

      if (!element) {
        return {
          success: false,
          message: `${targetType} '${target}' not found`,
        };
      }

      // 4. 验证新代码语法
      if (!this.parser.validate(newCode, filePath)) {
        return {
          success: false,
          message: 'New code has syntax errors',
        };
      }

      // 5. 替换代码
      const newContent =
        oldContent.substring(0, element.location.start) +
        newCode +
        oldContent.substring(element.location.end);

      // 6. 写入文件
      await fs.writeFile(filePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Successfully edited ${targetType} '${target}'`,
        oldCode: element.code,
        newCode,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to edit: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * 格式化代码
   *
   * @param code 源代码
   * @param filePath 文件路径
   * @returns 格式化后的代码
   */
  format(code: string, filePath: string): string {
    try {
      const ast = this.parser.parse(code, filePath);
      const output = generate(ast, {
        retainLines: true, // 保留原有行号
        comments: true, // 保留注释
      });
      return output.code;
    } catch (error) {
      return code; // 格式化失败，返回原代码
    }
  }
}
