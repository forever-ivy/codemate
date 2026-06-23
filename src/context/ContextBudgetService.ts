export interface ContextBudgetOptions {
  // 模型输入最多允许使用多少估算 token。本章先用估算值，后续可替换为真实 tokenizer。
  maxPromptTokens?: number;
  // 给模型回复预留的 token，不让上下文把整个窗口占满。
  reservedResponseTokens?: number;
  // 英文和代码场景里常见的粗略比例：约 4 个字符 ≈ 1 个 token。
  charsPerToken?: number;
}

export interface BudgetedText {
  content: string;
  estimatedTokens: number;
  originalEstimatedTokens: number;
  truncated: boolean;
}

export interface ContextBudgetState {
  maxPromptTokens: number;
  reservedResponseTokens: number;
  availableContextTokens: number;
  basePromptTokens: number;
  usedFileTokens: number;
  remainingFileTokens: number;
  truncatedFiles: string[];
}

/**
 * ContextBudgetService 负责估算上下文 token 使用量，并在超预算时裁剪文本。
 *
 * 调用链路：
 * ContextBuilderService.build -> ContextBudgetService.createState -> fitText
 *
 * 本章使用可解释的启发式估算，不依赖具体模型 tokenizer。
 * 后续章节可以把 estimateTokens 替换成模型相关 tokenizer，而不改 ContextBuilder 主流程。
 */
export class ContextBudgetService {
  constructor(private options: ContextBudgetOptions = {}) {}

  /**
   * 根据基础 prompt 创建一次上下文构建的预算状态。
   */
  createState(basePrompt: string): ContextBudgetState {
    // 1. 计算总输入预算，并扣除给模型回复预留的部分。
    const maxPromptTokens = this.options.maxPromptTokens ?? 8_000;
    const reservedResponseTokens = this.options.reservedResponseTokens ?? 1_000;
    const availableContextTokens = Math.max(0, maxPromptTokens - reservedResponseTokens);

    // 2. 基础仓库上下文也会消耗 token，文件内容只能使用剩余部分。
    const basePromptTokens = this.estimateTokens(basePrompt);
    const remainingFileTokens = Math.max(0, availableContextTokens - basePromptTokens);

    // 3. 返回可变状态，ContextBuilder 会随着文件加入逐步扣减。
    return {
      maxPromptTokens,
      reservedResponseTokens,
      availableContextTokens,
      basePromptTokens,
      usedFileTokens: 0,
      remainingFileTokens,
      truncatedFiles: [],
    };
  }

  /**
   * 把文本裁剪到指定 token 预算内。
   */
  fitText(content: string, availableTokens: number): BudgetedText {
    // 1. 没有可用预算时直接返回空内容，让调用方决定是否跳过文件。
    if (availableTokens <= 0) {
      return {
        content: '',
        estimatedTokens: 0,
        originalEstimatedTokens: this.estimateTokens(content),
        truncated: true,
      };
    }

    // 2. 未超预算时保留原文，避免不必要的截断。
    const originalEstimatedTokens = this.estimateTokens(content);
    if (originalEstimatedTokens <= availableTokens) {
      return {
        content,
        estimatedTokens: originalEstimatedTokens,
        originalEstimatedTokens,
        truncated: false,
      };
    }

    // 3. 超预算时按字符数粗略反推可保留长度，再重新估算一次。
    const charLimit = Math.max(0, Math.floor(availableTokens * this.charsPerToken()));
    const truncatedContent = content.slice(0, charLimit);

    return {
      content: truncatedContent,
      estimatedTokens: this.estimateTokens(truncatedContent),
      originalEstimatedTokens,
      truncated: true,
    };
  }

  /**
   * 估算文本 token 数。
   *
   * 英文、代码和标点按 charsPerToken 粗估。
   * 中文等非 ASCII 字符通常 token 密度更高，所以单独按 2 个字符约 1 个 token 估算。
   */
  estimateTokens(content: string): number {
    // 1. 空内容也至少返回 0，避免预算计算出现负数。
    if (!content) {
      return 0;
    }

    // 2. 分开统计 ASCII 和非 ASCII，让中文说明文档不会被低估太多。
    let asciiCount = 0;
    let nonAsciiCount = 0;
    for (const char of content) {
      if (char.charCodeAt(0) <= 127) {
        asciiCount += 1;
      } else {
        nonAsciiCount += 1;
      }
    }

    // 3. 这里是教学阶段的估算，不追求和某个模型 tokenizer 完全一致。
    const asciiTokens = Math.ceil(asciiCount / this.charsPerToken());
    const nonAsciiTokens = Math.ceil(nonAsciiCount / 2);
    return asciiTokens + nonAsciiTokens;
  }

  private charsPerToken(): number {
    return this.options.charsPerToken ?? 4;
  }
}
