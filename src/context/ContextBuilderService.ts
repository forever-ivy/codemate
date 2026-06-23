import * as fs from 'node:fs';
import * as path from 'pathe';
import { ContextBudgetService, type ContextBudgetState } from './ContextBudgetService';
import { ContextCompressionService, type ContextFileSummary } from './ContextCompressionService';
import {
  type ContextReference,
  type ContextReferenceKind,
  ContextReferenceService,
} from './ContextReferenceService';
import type { RepoMapFile, SelectedContext } from './RepoMapService';

export type ContextFileSkipReason =
  | 'unsupported-extension'
  | 'path-outside-cwd'
  | 'read-error'
  | 'binary-file'
  | 'budget-exhausted';

export interface ContextFileContent {
  // 仓库相对路径，和 RepoMapFile.path 保持一致，方便模型后续调用 read_file。
  path: string;
  content: string;
  size: number;
  bytesIncluded: number;
  estimatedTokens: number;
  originalEstimatedTokens: number;
  truncated: boolean;
}

export interface ContextSkippedFile {
  path: string;
  reason: ContextFileSkipReason;
}

export interface BuiltContext extends SelectedContext {
  includedFiles: ContextFileContent[];
  skippedFiles: ContextSkippedFile[];
  summaries: ContextFileSummary[];
  references: ContextReference[];
  budget: ContextBudgetState;
}

export interface ContextBuilderOptions {
  // 最多读取多少个候选文件，避免一次 prompt 带入太多内容。
  maxFiles?: number;
  // 单个文件最多读取多少字节。大文件会被截断，而不是完整塞进模型。
  maxBytesPerFile?: number;
  // 本次上下文总共最多读取多少字节，控制文件系统读取成本。
  maxTotalBytes?: number;
  // 模型输入预算。文件内容会在这个预算内被裁剪。
  maxPromptTokens?: number;
  // 给模型回复预留的 token，避免上下文占满整个窗口。
  reservedResponseTokens?: number;
  // 粗略 token 估算比例，默认 4 个 ASCII 字符约 1 个 token。
  charsPerToken?: number;
  // 每个截断文件摘要最多保留多少 import/export/require 线索。
  maxSummaryImportLines?: number;
  // 每个截断文件摘要最多保留多少声明符号。
  maxSummarySymbols?: number;
  // 每个截断文件摘要最多保留多少预览行。
  maxSummaryPreviewLines?: number;
  allowedExtensions?: string[];
}

/**
 * ContextBuilderService 把 RepoMap 选出的文件路径升级成可注入模型的文件内容上下文。
 *
 * 调用链路：
 * AgentLoop.execute -> RepoMapService.selectForMessage -> ContextBuilderService.build
 *
 * 本章同时做安全文本读取、字节预算和估算 token 预算。
 * 更精确的 tokenizer、摘要和引用追踪会在后续章节继续扩展。
 */
export class ContextBuilderService {
  private allowedExtensions: Set<string>;
  private budgetService: ContextBudgetService;
  private compressionService: ContextCompressionService;
  private referenceService: ContextReferenceService;

  constructor(
    private cwd: string,
    private options: ContextBuilderOptions = {}
  ) {
    this.budgetService = new ContextBudgetService({
      maxPromptTokens: options.maxPromptTokens,
      reservedResponseTokens: options.reservedResponseTokens,
      charsPerToken: options.charsPerToken,
    });
    this.compressionService = new ContextCompressionService({
      maxImportLines: options.maxSummaryImportLines,
      maxSymbols: options.maxSummarySymbols,
      maxPreviewLines: options.maxSummaryPreviewLines,
    });
    this.referenceService = new ContextReferenceService();
    this.allowedExtensions = new Set(
      options.allowedExtensions ?? [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.json',
        '.md',
        '.txt',
        '.css',
        '.html',
        '.yml',
        '.yaml',
        '.toml',
        '.py',
        '.go',
        '.rs',
      ]
    );
  }

  /**
   * 根据 RepoMap 选择结果读取少量文件内容，并生成新的 prompt。
   */
  build(selectedContext: SelectedContext): BuiltContext {
    // 1. 先从 RepoMap 选择出的文件开始。Context Builder 不重新做相关性排序，
    //    避免两个服务对“相关文件”产生不同判断。
    const candidates = selectedContext.selectedFiles.slice(0, this.options.maxFiles ?? 4);

    const includedFiles: ContextFileContent[] = [];
    const skippedFiles: ContextSkippedFile[] = [];
    let remainingBytes = this.options.maxTotalBytes ?? 16_000;
    const budget = this.budgetService.createState(selectedContext.prompt);

    // 2. 按顺序读取候选文件。越靠前的文件来自 RepoMap 更高分的选择结果。
    for (const file of candidates) {
      if (remainingBytes <= 0 || budget.remainingFileTokens <= 0) {
        skippedFiles.push({ path: file.path, reason: 'budget-exhausted' });
        continue;
      }

      const loaded = this.loadFile(file, remainingBytes);
      if ('reason' in loaded) {
        skippedFiles.push(loaded);
        continue;
      }

      const budgetedContent = this.budgetService.fitText(
        loaded.content,
        budget.remainingFileTokens
      );
      if (budgetedContent.estimatedTokens <= 0) {
        skippedFiles.push({ path: file.path, reason: 'budget-exhausted' });
        continue;
      }

      const includedFile = {
        ...loaded,
        content: budgetedContent.content,
        bytesIncluded: Buffer.byteLength(budgetedContent.content, 'utf8'),
        estimatedTokens: budgetedContent.estimatedTokens,
        originalEstimatedTokens: budgetedContent.originalEstimatedTokens,
        truncated: loaded.truncated || budgetedContent.truncated,
      };

      includedFiles.push(includedFile);
      remainingBytes -= includedFile.bytesIncluded;
      budget.usedFileTokens += includedFile.estimatedTokens;
      budget.remainingFileTokens = Math.max(
        0,
        budget.remainingFileTokens - includedFile.estimatedTokens
      );
      if (includedFile.truncated) {
        budget.truncatedFiles.push(includedFile.path);
      }
    }

    // 3. 为被截断的文件生成轻量摘要。摘要只基于已经读取到的文本片段，
    //    不额外调用模型，也不读取更多文件内容。
    const summaries = this.compressionService.buildSummaries(includedFiles);

    // 4. 为进入 prompt 的内容生成引用 ID。
    //    后续模型和调试者可以用 [ctx-1] 追溯到具体文件和行范围。
    const references = this.referenceService.buildReferences(includedFiles, summaries);

    // 5. 把文件内容追加到原有 Repository Context 后面。
    //    这样模型先看仓库形态，再看少量具体文件内容。
    return {
      ...selectedContext,
      includedFiles,
      skippedFiles,
      summaries,
      references,
      budget,
      prompt: this.formatPrompt(
        selectedContext.prompt,
        includedFiles,
        skippedFiles,
        summaries,
        references,
        budget
      ),
    };
  }

  /**
   * 读取单个文件，并处理路径穿越、扩展名、二进制内容和截断。
   */
  private loadFile(
    file: RepoMapFile,
    remainingBytes: number
  ): ContextFileContent | ContextSkippedFile {
    // 1. 只允许读取仓库内文件，避免模型通过路径选择读到仓库外内容。
    const absolutePath = path.resolve(this.cwd, file.path);
    if (!this.isInsideCwd(absolutePath)) {
      return { path: file.path, reason: 'path-outside-cwd' };
    }

    // 2. 只读取常见文本文件。本章不猜图片、压缩包、二进制数据的编码。
    if (!this.allowedExtensions.has(file.ext)) {
      return { path: file.path, reason: 'unsupported-extension' };
    }

    // 3. 读取一个受预算限制的字节片段。大文件只取开头，避免撑爆 prompt。
    const bytesToRead = Math.max(
      0,
      Math.min(this.options.maxBytesPerFile ?? 4_000, remainingBytes)
    );
    if (bytesToRead === 0) {
      return { path: file.path, reason: 'budget-exhausted' };
    }

    let buffer: Buffer;
    let bytesRead = 0;
    let size = file.size;
    try {
      const stats = fs.statSync(absolutePath);
      size = stats.size;
      buffer = Buffer.alloc(Math.min(bytesToRead, stats.size));
      const fd = fs.openSync(absolutePath, 'r');
      try {
        bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return { path: file.path, reason: 'read-error' };
    }

    const chunk = buffer.subarray(0, bytesRead);
    if (!this.isProbablyText(chunk)) {
      return { path: file.path, reason: 'binary-file' };
    }

    return {
      path: file.path,
      content: chunk.toString('utf8'),
      size,
      bytesIncluded: bytesRead,
      estimatedTokens: 0,
      originalEstimatedTokens: 0,
      truncated: size > bytesRead,
    };
  }

  /**
   * 判断目标路径是否仍在当前工作目录内。
   */
  private isInsideCwd(absolutePath: string): boolean {
    const relativePath = path.relative(this.cwd, absolutePath);
    return (
      relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
    );
  }

  /**
   * 用一个保守规则识别文本内容。
   *
   * 这里不做复杂编码检测，只拒绝包含空字节的内容。
   * 对 coding agent 来说，二进制文件应该通过专门工具或后续 artifact 处理。
   */
  private isProbablyText(buffer: Buffer): boolean {
    return !buffer.includes(0);
  }

  /**
   * 把读取到的文件内容格式化进模型 prompt。
   */
  private formatPrompt(
    basePrompt: string,
    includedFiles: ContextFileContent[],
    skippedFiles: ContextSkippedFile[],
    summaries: ContextFileSummary[],
    references: ContextReference[],
    budget: ContextBudgetState
  ): string {
    const lines = [
      basePrompt,
      '',
      'Context budget:',
      `- Max prompt tokens: ${budget.maxPromptTokens}`,
      `- Reserved response tokens: ${budget.reservedResponseTokens}`,
      `- Base context tokens: ${budget.basePromptTokens}`,
      `- File content tokens: ${budget.usedFileTokens}`,
      `- Remaining file tokens: ${budget.remainingFileTokens}`,
      '',
      'Context references:',
      ...this.formatReferences(references),
    ];

    if (summaries.length > 0) {
      lines.push(
        '',
        'Compressed context summaries:',
        ...this.formatSummaries(summaries, references)
      );
    }

    lines.push(
      '',
      'Relevant file contents:',
      ...this.formatIncludedFiles(includedFiles, references)
    );

    if (skippedFiles.length > 0) {
      lines.push('', 'Skipped context files:', ...this.formatSkippedFiles(skippedFiles));
    }

    return lines.join('\n');
  }

  private formatIncludedFiles(
    files: ContextFileContent[],
    references: ContextReference[]
  ): string[] {
    if (files.length === 0) {
      return ['- none loaded'];
    }

    return files.flatMap((file) => {
      const reference = this.findReference(references, 'file-content', file.path);

      return [
        `### ${this.formatReferenceLabel(reference)} ${file.path}`,
        `Size: ${file.size} bytes; included: ${file.bytesIncluded} bytes; estimated tokens: ${file.estimatedTokens}/${file.originalEstimatedTokens}; truncated: ${file.truncated}`,
        '```',
        file.content.trimEnd(),
        '```',
        '',
      ];
    });
  }

  private formatSkippedFiles(files: ContextSkippedFile[]): string[] {
    return files.map((file) => `- ${file.path} (${file.reason})`);
  }

  private formatSummaries(
    summaries: ContextFileSummary[],
    references: ContextReference[]
  ): string[] {
    return summaries.flatMap((summary) => {
      const reference = this.findReference(references, 'compressed-summary', summary.path);

      return [
        `### ${this.formatReferenceLabel(reference)} ${summary.path}`,
        `Reason: ${summary.reason}; lines seen: ${summary.lineCount}; tokens: ${summary.estimatedTokens}/${summary.originalEstimatedTokens}`,
        `Imports: ${summary.imports.length > 0 ? summary.imports.join(' | ') : 'none detected'}`,
        `Symbols: ${summary.symbols.length > 0 ? summary.symbols.join(', ') : 'none detected'}`,
        'Preview:',
        ...summary.preview.map((line) => `- ${line}`),
        '',
      ];
    });
  }

  private formatReferences(references: ContextReference[]): string[] {
    if (references.length === 0) {
      return ['- none'];
    }

    return references.map((reference) => {
      const bytes =
        reference.bytesIncluded !== undefined ? `; bytes: ${reference.bytesIncluded}` : '';
      return `- [${reference.id}] ${reference.kind}: ${reference.path} lines ${reference.startLine}-${reference.endLine}${bytes}`;
    });
  }

  private findReference(
    references: ContextReference[],
    kind: ContextReferenceKind,
    filePath: string
  ): ContextReference | undefined {
    return this.referenceService.findReference(references, kind, filePath);
  }

  private formatReferenceLabel(reference: ContextReference | undefined): string {
    return reference ? `[${reference.id}]` : '[untracked]';
  }
}
