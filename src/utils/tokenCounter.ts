/**
 * 简单的 Token 计数器
 *
 * 注意：这是一个简化的实现，实际应该使用 tiktoken 等库
 * 对于 Claude，可以使用 Anthropic 的 token 计数 API
 */
export function countTokens(text: string): number {
  // 简单估算：1 token ≈ 4 字符
  // 这是一个粗略的估算，实际应该使用专门的 tokenizer
  return Math.ceil(text.length / 4);
}

/**
 * 计算消息的 token 数量
 */
export function countMessageTokens(message: any): number {
  let tokens = 0;

  if (typeof message.content === 'string') {
    tokens += countTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text') {
        tokens += countTokens(part.text);
      } else if (part.type === 'tool-result') {
        const resultContent =
          typeof part.result?.llmContent === 'string'
            ? part.result.llmContent
            : JSON.stringify(part.result?.llmContent || '');
        tokens += countTokens(resultContent);
      }
    }
  }

  return tokens;
}

/**
 * 计算所有消息的总 token 数量
 */
export function countTotalTokens(messages: any[]): number {
  return messages.reduce((total, msg) => total + countMessageTokens(msg), 0);
}
