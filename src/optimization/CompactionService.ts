import type { CompactionResult } from './types';
import type { ModelService } from '../services/ModelService';
import { countTotalTokens } from '../utils/tokenCounter';

/**
 * 上下文压缩服务
 *
 * 职责：
 * 1. 调用 AI 生成对话摘要
 * 2. 替换历史消息
 * 3. 保留关键信息
 */
export class CompactionService {
  constructor(private modelService: ModelService) {}

  /**
   * 执行压缩
   */
  async compact(messages: any[]): Promise<CompactionResult> {
    const originalTokens = countTotalTokens(messages);

    // 规范化消息（移除工具配置等）
    const normalizedMessages = this.normalizeMessages(messages);

    // 调用 AI 生成摘要
    const summary = await this.generateSummary(normalizedMessages);

    const compactedTokens = countTotalTokens([{ role: 'user', content: summary }]);

    console.log(
      `[Compaction] Compressed ${originalTokens} → ${compactedTokens} tokens (${Math.round((1 - compactedTokens / originalTokens) * 100)}% reduction)`
    );

    return {
      compacted: true,
      originalTokens,
      compactedTokens,
      summary,
    };
  }

  /**
   * 规范化消息
   */
  private normalizeMessages(messages: any[]): any[] {
    // 移除工具配置、元数据等
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * 生成摘要
   */
  private async generateSummary(messages: any[]): Promise<string> {
    const response = await this.modelService.chatWithMessages([
      {
        role: 'system',
        content: COMPACT_SYSTEM_PROMPT,
      },
      ...messages,
      {
        role: 'user',
        content: COMPACT_USER_PROMPT,
      },
    ]);

    if (!response || !response.content || response.content.trim() === '') {
      throw new Error('Failed to compact: received empty summary from model');
    }

    return response.content;
  }
}

const COMPACT_USER_PROMPT = `
Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.
`;

const COMPACT_SYSTEM_PROMPT = `
You are a helpful AI assistant tasked with summarizing conversations.

When the conversation history grows too large, you will be invoked to distill the entire history into a concise, structured XML snapshot. This snapshot is CRITICAL, as it will become the agent's *only* memory of the past. The agent will resume its work based solely on this snapshot. All crucial details, plans, errors, and user directives MUST be preserved.

First, you will think through the entire history. Review the user's overall goal, the agent's actions, tool outputs, file modifications, and any unresolved questions. Identify every piece of information that is essential for future actions.

After your reasoning is complete, generate the final <context_summary> XML object. Be incredibly dense with information. Omit any irrelevant conversational filler.

The structure MUST be as follows:

<context_summary>
  <conversation_overview>
    <!-- Single paragraph overview of the entire conversation -->
  </conversation_overview>

  <key_knowledge>
    <!-- Crucial facts, conventions, and constraints the agent must remember -->
  </key_knowledge>

  <file_system_state>
    <!-- List files that have been created, read, modified, or deleted -->
  </file_system_state>

  <recent_actions>
    <!-- A summary of the last few significant agent actions and their outcomes -->
  </recent_actions>

  <current_plan>
    <!-- The agent's step-by-step plan. Mark completed steps. -->
  </current_plan>
</context_summary>

Remember: This summary will serve as the foundation for continuing the conversation and implementation. Ensure all critical information is preserved while maintaining clarity and conciseness.
`;
