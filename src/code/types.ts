/**
 * 代码元素类型
 */
export type CodeElementType =
  | 'function' // 函数
  | 'class' // 类
  | 'method' // 方法
  | 'variable' // 变量
  | 'import' // 导入语句
  | 'export'; // 导出语句

/**
 * 代码位置
 */
export interface CodeLocation {
  start: number; // 起始位置
  end: number; // 结束位置
  line: number; // 行号
  column: number; // 列号
}

/**
 * 代码元素
 */
export interface CodeElement {
  type: CodeElementType;
  name: string;
  location: CodeLocation;
  code: string; // 代码内容
  parent?: string; // 父元素名称（如类名）
}

/**
 * 编辑结果
 */
export interface EditResult {
  success: boolean;
  message: string;
  oldCode?: string;
  newCode?: string;
}
