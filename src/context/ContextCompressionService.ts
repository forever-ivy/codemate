export interface ContextCompressionOptions {
  // 每个摘要最多保留多少 import/export/require 线索，避免摘要本身变得太长。
  maxImportLines?: number;
  // 每个摘要最多保留多少声明符号，例如 class、function、interface。
  maxSymbols?: number;
  // 预览片段最多保留多少个非空行。
  maxPreviewLines?: number;
}

export interface CompressibleContextFile {
  path: string;
  content: string;
  estimatedTokens: number;
  originalEstimatedTokens: number;
  truncated: boolean;
}

export interface ContextFileSummary {
  path: string;
  reason: 'truncated-file';
  lineCount: number;
  estimatedTokens: number;
  originalEstimatedTokens: number;
  imports: string[];
  symbols: string[];
  preview: string[];
}

/**
 * ContextCompressionService 为被截断的上下文文件生成轻量摘要。
 *
 * 调用链路：
 * ContextBuilderService.build -> ContextCompressionService.buildSummaries -> formatPrompt
 *
 * 本章先做确定性的结构摘要，不额外调用 LLM。
 * 这样摘要结果可测试、成本低，也不会让上下文构建流程变成递归模型调用。
 */
export class ContextCompressionService {
  constructor(private options: ContextCompressionOptions = {}) {}

  /**
   * 为一组已读取文件生成摘要。
   *
   * 只有被截断的文件才需要摘要。未截断文件已经完整进入 prompt，
   * 再生成摘要只会重复占用上下文。
   */
  buildSummaries(files: CompressibleContextFile[]): ContextFileSummary[] {
    // 1. 先筛选被截断的文件。这里的 truncated 可能来自字节预算，
    //    也可能来自 token 预算，调用方不需要区分来源。
    return files.filter((file) => file.truncated).map((file) => this.summarizeFile(file));
  }

  /**
   * 从单个文件片段里提取结构化摘要。
   */
  private summarizeFile(file: CompressibleContextFile): ContextFileSummary {
    // 1. 按行切分，后续 import、符号和预览都基于行处理。
    const lines = file.content.split('\n');

    // 2. 提取依赖线索。模型即使看不到完整文件，也能知道它大概依赖谁。
    const imports = this.extractImports(lines);

    // 3. 提取声明符号。这里不做 AST 解析，只用轻量规则找常见声明。
    const symbols = this.extractSymbols(lines);

    // 4. 保留文件开头的少量非空行，帮助模型看到局部风格和入口代码。
    const preview = this.extractPreview(lines);

    return {
      path: file.path,
      reason: 'truncated-file',
      lineCount: lines.length,
      estimatedTokens: file.estimatedTokens,
      originalEstimatedTokens: file.originalEstimatedTokens,
      imports,
      symbols,
      preview,
    };
  }

  private extractImports(lines: string[]): string[] {
    const importPattern =
      /^\s*(import\s.+from\s.+;?|import\s.+;|export\s.+from\s.+;?|const\s.+require\(.+\);?)/;
    return lines
      .map((line) => line.trim())
      .filter((line) => importPattern.test(line))
      .slice(0, this.options.maxImportLines ?? 6);
  }

  private extractSymbols(lines: string[]): string[] {
    const symbolPattern =
      /^\s*(export\s+)?(async\s+)?(class|function|interface|type|const|let|var|enum)\s+([A-Za-z0-9_$]+)/;

    const symbols: string[] = [];
    for (const line of lines) {
      const match = line.match(symbolPattern);
      if (!match) {
        continue;
      }

      const [, exported = '', asyncKeyword = '', kind, name] = match;
      const prefix = `${exported}${asyncKeyword}${kind}`.trim().replace(/\s+/g, ' ');
      symbols.push(`${prefix} ${name}`);

      if (symbols.length >= (this.options.maxSymbols ?? 8)) {
        break;
      }
    }

    return symbols;
  }

  private extractPreview(lines: string[]): string[] {
    return lines
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0)
      .slice(0, this.options.maxPreviewLines ?? 4);
  }
}
