import { Tool } from '../base/Tool';
import { z } from 'zod';
import { CodeEditor } from '../../code/CodeEditor';
import type { CodeElementType } from '../../code/types';

/**
 * EditCodeTool - 智能代码编辑工具
 *
 * 功能：
 * 1. 使用 AST 精确编辑代码
 * 2. 支持函数、类、方法等
 * 3. 自动验证语法
 */
export class EditCodeTool extends Tool<
  {
    path: string;
    target: string;
    targetType: CodeElementType;
    newCode: string;
    parent?: string;
  },
  {
    success: boolean;
    message: string;
    oldCode?: string;
    newCode?: string;
  }
> {
  name = 'edit_code';

  description =
    '智能编辑代码。使用 AST 精确定位和替换函数、类、方法等代码元素。' +
    '\n\n使用示例：' +
    '\n1. 修改函数：{ path: "src/utils.ts", target: "add", targetType: "function", newCode: "function add(a, b) { return a + b; }" }' +
    '\n2. 修改类方法：{ path: "src/User.ts", target: "getName", targetType: "method", parent: "User", newCode: "getName() { return this.name; }" }' +
    '\n3. 修改类：{ path: "src/User.ts", target: "User", targetType: "class", newCode: "class User { ... }" }' +
    '\n\n注意：newCode 必须是完整的、语法正确的代码。';

  schema = z.object({
    path: z.string().describe('文件路径'),
    target: z.string().describe('目标名称（如函数名、类名）'),
    targetType: z
      .enum(['function', 'class', 'method', 'variable', 'import', 'export'])
      .describe('目标类型'),
    newCode: z.string().describe('新代码'),
    parent: z.string().optional().describe('父元素名称（查找方法时需要）'),
  });

  async execute(input: {
    path: string;
    target: string;
    targetType: CodeElementType;
    newCode: string;
    parent?: string;
  }): Promise<{
    success: boolean;
    message: string;
    oldCode?: string;
    newCode?: string;
  }> {
    console.log(`🔧 Editing ${input.targetType} '${input.target}' in ${input.path}`);

    // 🔥 在编辑前追踪文件
    if (this.container) {
      const fileHistory = this.container.getFileHistory();
      await fileHistory.trackFile(input.path);
    }

    const editor = new CodeEditor();
    const result = await editor.edit(
      input.path,
      input.target,
      input.targetType,
      input.newCode,
      input.parent
    );

    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.error(`❌ ${result.message}`);
    }

    return result;
  }
}
