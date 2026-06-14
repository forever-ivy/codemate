/**
 * OutputStyle - 输出样式类
 *
 * 职责：
 * 1. 定义输出样式的属性
 * 2. 提供样式信息
 * 3. 判断是否为默认样式
 *//**
 * OutputStyle 选项
 */
export interface OutputStyleOpts {
  name: string; // 样式名称
  description: string; // 样式描述
  isCodingRelated: boolean; // 是否与编程相关
  prompt: string; // 提示词内容
}

/**
 * OutputStyle 类
 */ export class OutputStyle {
  name: string;
  description: string;
  isCodingRelated: boolean;
  prompt: string;

  constructor(opts: OutputStyleOpts) {
    this.name = opts.name;
    this.description = opts.description;
    this.isCodingRelated = opts.isCodingRelated;
    this.prompt = opts.prompt;
  }

  /**
   * 判断是否为默认样式
   */
  isDefault(): boolean {
    return this.name === 'Default';
  }
}
