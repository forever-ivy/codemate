import * as path from 'pathe';
import { OutputStyle } from '../base/OutputStyle';
import { getBuiltinOutputStyles } from '../builtin/index';
import { loadMarkdownFiles } from '../utils/markdown';
import type { Paths } from '../../services/Paths';

/**
 * OutputStyleManager 选项
 */
export interface OutputStyleManagerOpts {
  paths: Paths;
  outputStyles?: OutputStyle[];
}

/**
 * OutputStyleManager - 输出样式管理器
 *
 * 职责：
 * 1. 管理所有输出样式
 * 2. 加载内置、全局、项目样式
 * 3. 提供样式查询接口
 * 4. 支持自定义样式
 */
export class OutputStyleManager {
  private outputStyles: Map<string, OutputStyle> = new Map();

  constructor(opts: OutputStyleManagerOpts) {
    // 加载所有样式
    const allStyles = this.load(opts.paths);

    // 添加额外的样式
    if (opts.outputStyles) {
      allStyles.push(...opts.outputStyles);
    }

    // 注册到 Map
    for (const style of allStyles) {
      this.outputStyles.set(style.name, style);
    }
  }

  /**
   * 加载所有样式
   */
  private load(paths: Paths): OutputStyle[] {
    // 1. 加载内置样式
    const builtin = getBuiltinOutputStyles().map((opts) => new OutputStyle(opts));

    // 2. 加载全局样式
    const globalDir = path.join(paths.globalConfigDir, 'output-styles');
    const global = this.loadGlobal(globalDir);

    // 3. 加载项目样式
    const projectDir = path.join(paths.projectConfigDir, 'output-styles');
    const project = this.loadProject(projectDir);

    // 优先级：内置 < 全局 < 项目
    return [...builtin, ...global, ...project];
  }

  /**
   * 加载全局样式
   */
  private loadGlobal(dir: string): OutputStyle[] {
    const files = loadMarkdownFiles(dir);
    return files.map((file) => {
      return new OutputStyle({
        name: file.name,
        description: `${file.description} (user)`,
        isCodingRelated: !!file.attributes.isCodingRelated,
        prompt: file.body,
      });
    });
  }

  /**
   * 加载项目样式
   */
  private loadProject(dir: string): OutputStyle[] {
    const files = loadMarkdownFiles(dir);
    return files.map((file) => {
      return new OutputStyle({
        name: file.name,
        description: `${file.description} (project)`,
        isCodingRelated: !!file.attributes.isCodingRelated,
        prompt: file.body,
      });
    });
  }

  /**
   * 获取输出样式
   *
   * 支持三种方式：
   * 1. 样式名称: 'Concise'
   * 2. 文件路径: './my-style.md' 或 '/abs/path/style.md'
   * 3. JSON 字符串: '{"name":"Custom","prompt":"..."}'
   */
  getOutputStyle(name: string | undefined, cwd: string): OutputStyle {
    // 如果没有指定，返回默认样式
    if (!name) {
      return this.getDefaultOutputStyle();
    }

    // 1. 检查是否为文件路径
    if (name.endsWith('.md')) {
      return this.loadFromFile(name, cwd);
    }

    // 2. 检查是否为 JSON 字符串
    if (name.startsWith('{') && name.endsWith('}')) {
      return this.loadFromJSON(name);
    }

    // 3. 按名称查找
    const style = this.outputStyles.get(name);
    if (!style) {
      throw new Error(`Output style "${name}" not found`);
    }

    return style;
  }

  /**
   * 从文件加载样式
   */
  private loadFromFile(filePath: string, cwd: string): OutputStyle {
    const { loadNormalizedMarkdownFile } = require('../utils/markdown');

    // 处理相对路径
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath)) {
      absolutePath = path.resolve(cwd, filePath);

      // 防止路径遍历攻击
      if (!absolutePath.startsWith(path.resolve(cwd))) {
        throw new Error('Path traversal not allowed');
      }
    }

    const file = loadNormalizedMarkdownFile(absolutePath);
    return new OutputStyle({
      name: file.name,
      description: file.description,
      isCodingRelated: !!file.attributes.isCodingRelated,
      prompt: file.body,
    });
  }

  /**
   * 从 JSON 字符串加载样式
   */
  private loadFromJSON(json: string): OutputStyle {
    try {
      const data = JSON.parse(json);

      if (!data.prompt) {
        throw new Error('prompt is required');
      }

      return new OutputStyle({
        name: data.name || 'Custom',
        description: data.description || 'Custom output style',
        isCodingRelated: data.isCodingRelated ?? true,
        prompt: data.prompt,
      });
    } catch (error) {
      throw new Error(
        `Invalid JSON output style: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取默认样式
   */
  getDefaultOutputStyle(): OutputStyle {
    const defaultStyle = this.outputStyles.get('Default');
    if (!defaultStyle) {
      throw new Error('Default output style not found');
    }
    return defaultStyle;
  }

  /**
   * 列出所有样式
   */
  list(): OutputStyle[] {
    return Array.from(this.outputStyles.values());
  }

  /**
   * 列出与编程相关的样式
   */
  listCodingRelated(): OutputStyle[] {
    return this.list().filter((style) => style.isCodingRelated);
  }
}
