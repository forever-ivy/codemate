import { describe, expect, it } from 'vitest';
import { buildProcessingIndicatorViewModel } from '../../../src/ui/workbench/ProcessingIndicatorViewModel';

describe('ProcessingIndicatorViewModel', () => {
  it('builds elapsed time and a bounded task label', () => {
    const viewModel = buildProcessingIndicatorViewModel({
      active: true,
      startedAt: 1_000,
      now: 13_000,
      currentTask: `Editing ${'src/components/VeryLongComponent.tsx '.repeat(5)}`,
    });

    expect(viewModel?.elapsedSeconds).toBe(12);
    expect(viewModel?.detail.length).toBeLessThanOrEqual(80);
  });

  it('returns undefined while idle', () => {
    expect(buildProcessingIndicatorViewModel({ active: false, now: 1_000 })).toBeUndefined();
  });
});
