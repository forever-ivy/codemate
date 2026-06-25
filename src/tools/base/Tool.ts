import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Container } from '../../application/Container';
/**
 * 工具基类
 *
 * 所有工具都必须继承这个类
 *
 * 为什么用抽象类？
 * - 定义标准接口
 * - 强制子类实现必要方法
 * - 提供通用功能（如 validate）
 *
 * 泛型参数：
 * - TInput：工具的输入类型
 * - TOutput：工具的输出类型
 */
export abstract class Tool<TInput = unknown, TOutput = unknown> {
  /**
   * 工具名称
   *
   * 必须唯一，用于标识工具
   * 命名规范：小写字母 + 下划线
   *
   * 示例：'read_file', 'write_file', 'search_code'
   */
  abstract name: string;

  /**
   * 工具描述
   *
   * 简短说明工具的功能
   * AI 会根据这个描述决定是否使用这个工具
   *
   * 示例：'读取文件内容'
   */
  abstract description: string;

  /**
   * 输入模式
   *
   * 使用 Zod 定义工具需要什么参数
   * 用于运行时验证输入
   *
   * 示例：
   * z.object({
   *   path: z.string().describe('文件路径')
   * })
   */
  abstract schema: z.ZodSchema<TInput>;

  /**
   * 执行工具
   *
   * 这是工具的核心逻辑
   * 子类必须实现这个方法
   *
   * @param input 已验证的输入
   * @returns 工具执行结果
   */

  // 🔥 新增：Container 引用
  protected container?: Container;

  abstract execute(input: TInput): Promise<TOutput>;

  /**
   * 设置 Container
   *
   * 由 ToolManager 在注册时调用
   */
  setContainer(container: Container): void {
    this.container = container;
  }

  /**
   * 验证输入
   *
   * 这是基类提供的通用功能
   * 所有工具都可以用这个方法验证输入
   *
   * @param input 未验证的输入
   * @returns 验证后的输入
   * @throws 如果输入不符合 schema
   */
  validate(input: unknown): TInput {
    try {
      return this.schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        throw new Error(`Invalid input for ${this.name}: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * 获取工具信息
   *
   * 返回工具的元数据
   * 主要用于调试和日志
   */
  getInfo(): { name: string; description: string } {
    return {
      name: this.name,
      description: this.description,
    };
  }

  /**
   * 获取 JSON Schema
   *
   * 将 Zod schema 转换为 JSON Schema
   * 用于 Function Calling
   *
   * 注意：当前项目使用 Zod 3.x，所以这里通过 zod-to-json-schema 转换。
   * 这样 ToolManager 导出的工具契约可以稳定服务于模型调用、调试和评测。
   */
  getJsonSchema(): Record<string, unknown> {
    const jsonSchema = zodToJsonSchema(this.schema);

    // 移除 $schema 字段（OpenAI API 不需要）
    const { $schema, ...rest } = jsonSchema;
    return rest;
  }
}
