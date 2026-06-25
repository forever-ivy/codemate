import traverse from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { CodeElement, CodeElementType, CodeLocation } from './types';

// 🔥 修复 @babel/traverse 的 ESM 导入问题
const traverseFunction = typeof traverse === 'function' ? traverse : (traverse as any).default;

/**
 * CodeLocator - 代码定位器
 *
 * 功能：
 * 1. 在 AST 中查找代码元素
 * 2. 支持函数、类、方法等
 * 3. 返回位置信息
 */
export class CodeLocator {
  /**
   * 查找代码元素
   *
   * @param ast AST
   * @param name 元素名称
   * @param type 元素类型
   * @param parent 父元素名称（可选，用于查找方法）
   * @returns 代码元素
   */
  find(ast: File, name: string, type: CodeElementType, parent?: string): CodeElement | null {
    let found: CodeElement | null = null;

    traverseFunction(ast, {
      // 查找函数
      FunctionDeclaration(path: any) {
        if (type === 'function' && path.node.id?.name === name) {
          // 🔥 检查是否有 export
          const parentPath = path.parentPath;
          const isExported = parentPath && t.isExportNamedDeclaration(parentPath.node);

          found = {
            type: 'function',
            name,
            location: isExported ? getLocation(parentPath.node) : getLocation(path.node),
            code: isExported ? parentPath.toString() : path.toString(),
          };
          path.stop();
        }
      },

      // 查找类
      ClassDeclaration(path: any) {
        if (type === 'class' && path.node.id?.name === name) {
          // 🔥 检查是否有 export
          const parentPath = path.parentPath;
          const isExported = parentPath && t.isExportNamedDeclaration(parentPath.node);

          found = {
            type: 'class',
            name,
            location: isExported ? getLocation(parentPath.node) : getLocation(path.node),
            code: isExported ? parentPath.toString() : path.toString(),
          };
          path.stop();
        }
      },

      // 查找方法
      ClassMethod(path: any) {
        if (type === 'method') {
          // 获取类名
          const classPath = path.findParent((p: any) => p.isClassDeclaration());
          const className =
            classPath && t.isClassDeclaration(classPath.node) ? classPath.node.id?.name : undefined;

          // 检查是否匹配
          if (
            className === parent &&
            t.isIdentifier(path.node.key) &&
            path.node.key.name === name
          ) {
            found = {
              type: 'method',
              name,
              location: getLocation(path.node),
              code: path.toString(),
              parent: className,
            };
            path.stop();
          }
        }
      },

      // 查找变量
      VariableDeclarator(path: any) {
        if (type === 'variable' && t.isIdentifier(path.node.id) && path.node.id.name === name) {
          found = {
            type: 'variable',
            name,
            location: getLocation(path.node),
            code: path.toString(),
          };
          path.stop();
        }
      },
    });

    return found;
  }

  /**
   * 列出所有函数
   *
   * @param ast AST
   * @returns 函数列表
   */
  listFunctions(ast: File): CodeElement[] {
    const functions: CodeElement[] = [];

    traverseFunction(ast, {
      FunctionDeclaration(path: any) {
        if (path.node.id) {
          // 🔥 检查是否有 export
          const parentPath = path.parentPath;
          const isExported = parentPath && t.isExportNamedDeclaration(parentPath.node);

          functions.push({
            type: 'function',
            name: path.node.id.name,
            location: isExported ? getLocation(parentPath.node) : getLocation(path.node),
            code: isExported ? parentPath.toString() : path.toString(),
          });
        }
      },
    });

    return functions;
  }

  /**
   * 列出所有类
   *
   * @param ast AST
   * @returns 类列表
   */
  listClasses(ast: File): CodeElement[] {
    const classes: CodeElement[] = [];

    traverseFunction(ast, {
      ClassDeclaration(path: any) {
        if (path.node.id) {
          // 🔥 检查是否有 export
          const parentPath = path.parentPath;
          const isExported = parentPath && t.isExportNamedDeclaration(parentPath.node);

          classes.push({
            type: 'class',
            name: path.node.id.name,
            location: isExported ? getLocation(parentPath.node) : getLocation(path.node),
            code: isExported ? parentPath.toString() : path.toString(),
          });
        }
      },
    });

    return classes;
  }
}

/**
 * 获取节点位置
 */ function getLocation(node: any): CodeLocation {
  return {
    start: node.start || 0,
    end: node.end || 0,
    line: node.loc?.start.line || 0,
    column: node.loc?.start.column || 0,
  };
}
