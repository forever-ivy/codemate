export type ContextReferenceKind = 'file-content' | 'compressed-summary';

export interface ReferenceableContextFile {
  path: string;
  content: string;
  bytesIncluded: number;
}

export interface ReferenceableContextSummary {
  path: string;
  lineCount: number;
}

export interface ContextReference {
  id: string;
  kind: ContextReferenceKind;
  path: string;
  startLine: number;
  endLine: number;
  bytesIncluded?: number;
}

export interface ContextReferenceOptions {
  idPrefix?: string;
}

/**
 * ContextReferenceService 为注入模型的上下文片段生成可追踪引用。
 *
 * 调用链路：
 * ContextBuilderService.build -> ContextReferenceService.buildReferences -> formatPrompt
 *
 * 它不读取文件，也不改变上下文选择结果，只根据已经进入 prompt 的内容
 * 记录“这段上下文来自哪里”，方便模型和调试者回到源文件。
 */
export class ContextReferenceService {
  constructor(private options: ContextReferenceOptions = {}) {}

  /**
   * 为文件内容和压缩摘要生成一组稳定引用。
   */
  buildReferences(
    files: ReferenceableContextFile[],
    summaries: ReferenceableContextSummary[]
  ): ContextReference[] {
    // 1. 引用 ID 按 prompt 出现顺序生成，让读者能从上到下对应。
    let nextId = 1;
    const references: ContextReference[] = [];

    // 2. 文件内容引用追踪到实际进入 prompt 的行范围。
    for (const file of files) {
      references.push({
        id: this.createId(nextId++),
        kind: 'file-content',
        path: file.path,
        startLine: 1,
        endLine: this.countLines(file.content),
        bytesIncluded: file.bytesIncluded,
      });
    }

    // 3. 摘要引用说明摘要来自哪个文件片段。摘要不是完整原文，
    //    所以 endLine 使用摘要生成时看到的片段行数。
    for (const summary of summaries) {
      references.push({
        id: this.createId(nextId++),
        kind: 'compressed-summary',
        path: summary.path,
        startLine: 1,
        endLine: Math.max(1, summary.lineCount),
      });
    }

    return references;
  }

  /**
   * 查找某个 prompt 片段对应的引用。
   */
  findReference(
    references: ContextReference[],
    kind: ContextReferenceKind,
    filePath: string
  ): ContextReference | undefined {
    return references.find((reference) => reference.kind === kind && reference.path === filePath);
  }

  private createId(index: number): string {
    return `${this.options.idPrefix ?? 'ctx'}-${index}`;
  }

  private countLines(content: string): number {
    if (content.length === 0) {
      return 1;
    }

    return content.split('\n').length;
  }
}
