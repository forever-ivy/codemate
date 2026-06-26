const MAX_DETAIL_LENGTH = 80;

export interface ProcessingIndicatorInput {
  active: boolean;
  startedAt?: number;
  now: number;
  currentTask?: string;
}

export interface ProcessingIndicatorViewModel {
  elapsedSeconds: number;
  detail?: string;
}

/** Keeps the animated status line bounded so it never changes terminal height. */
export function buildProcessingIndicatorViewModel(
  input: ProcessingIndicatorInput
): ProcessingIndicatorViewModel | undefined {
  if (!input.active) {
    return undefined;
  }

  const compactTask = input.currentTask?.replace(/\s+/g, ' ').trim();
  const detail = compactTask
    ? compactTask.length > MAX_DETAIL_LENGTH
      ? `${compactTask.slice(0, MAX_DETAIL_LENGTH - 1).trimEnd()}…`
      : compactTask
    : undefined;

  return {
    elapsedSeconds: input.startedAt
      ? Math.max(0, Math.floor((input.now - input.startedAt) / 1_000))
      : 0,
    ...(detail ? { detail } : {}),
  };
}
