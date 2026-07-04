import { describe, expect, it } from 'vitest';
import { ContextBudgetService } from '../../../src/context/ContextBudgetService';

describe('ContextBudgetService', () => {
  it('should estimate ascii and non-ascii text tokens', () => {
    const service = new ContextBudgetService({
      charsPerToken: 4,
    });

    expect(service.estimateTokens('abcd')).toBe(1);
    expect(service.estimateTokens('abcdefgh')).toBe(2);
    expect(service.estimateTokens('你好世界')).toBe(2);
  });

  it('should create a budget state after reserving response tokens', () => {
    const service = new ContextBudgetService({
      maxPromptTokens: 100,
      reservedResponseTokens: 20,
      charsPerToken: 4,
    });

    const state = service.createState('a'.repeat(40));

    expect(state.maxPromptTokens).toBe(100);
    expect(state.reservedResponseTokens).toBe(20);
    expect(state.availableContextTokens).toBe(80);
    expect(state.basePromptTokens).toBe(10);
    expect(state.remainingFileTokens).toBe(70);
  });

  it('should keep text unchanged when it fits the budget', () => {
    const service = new ContextBudgetService({
      charsPerToken: 4,
    });

    const result = service.fitText('abcd', 2);

    expect(result).toEqual({
      content: 'abcd',
      estimatedTokens: 1,
      originalEstimatedTokens: 1,
      truncated: false,
    });
  });

  it('should truncate text when it exceeds the budget', () => {
    const service = new ContextBudgetService({
      charsPerToken: 4,
    });

    const result = service.fitText('abcdefghijkl', 2);

    expect(result.content).toBe('abcdefgh');
    expect(result.estimatedTokens).toBe(2);
    expect(result.originalEstimatedTokens).toBe(3);
    expect(result.truncated).toBe(true);
  });
});
