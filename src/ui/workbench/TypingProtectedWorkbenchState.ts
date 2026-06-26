import type { LiveModelOutputState } from '../components/LiveModelOutput';
import type { TaskItem } from '../components/TaskTracker';

export interface TypingProtectedWorkbenchState {
  tasks: TaskItem[];
  currentTask: string;
  liveModelOutput?: LiveModelOutputState;
}

export interface TypingProtectedWorkbenchStateInput {
  current: TypingProtectedWorkbenchState;
  previous?: TypingProtectedWorkbenchState;
  inputDraftActive: boolean;
}

/**
 * Freezes dynamic workbench content while the user is editing the composer.
 *
 * Model and tool events may continue updating runtime buffers, but the visible
 * timeline/current task stays on the last stable frame until the draft clears.
 * This keeps the input line from competing with upper-screen layout changes.
 */
export function selectTypingProtectedWorkbenchState(
  input: TypingProtectedWorkbenchStateInput
): TypingProtectedWorkbenchState {
  if (!input.inputDraftActive || !input.previous) {
    return input.current;
  }

  return input.previous;
}
