import type { ToolApprovalRequest } from '../../tools/ToolApprovalRequestService';
import type { EnhancedMessage } from '../../types/index';
import { splitWorkbenchMessages } from './WorkbenchRenderSegments';

export interface StableTerminalFrameInput {
  messages: EnhancedMessage[];
  runActive: boolean;
  dynamicMessageStartIndex?: number;
  pendingApproval?: ToolApprovalRequest | boolean;
  liveOutputVisible?: boolean;
  inputDraftActive?: boolean;
}

export interface StableTerminalFrame {
  transcript: {
    completedMessages: EnhancedMessage[];
    pendingMessages: EnhancedMessage[];
  };
  slots: {
    activity: StableTerminalVisibilitySlot;
    approval: StableTerminalApprovalSlot;
    liveOutput: StableTerminalLiveOutputSlot;
    composer: StableTerminalComposerSlot;
  };
}

export interface StableTerminalVisibilitySlot {
  visible: boolean;
  reservedLines: number;
}

export interface StableTerminalApprovalSlot {
  visible: boolean;
  anchor: 'above-composer';
  capturesKeyboard: boolean;
  help: string;
}

export interface StableTerminalLiveOutputSlot {
  visible: boolean;
  reservedLines: number;
  reason?: 'input-draft-active' | 'not-streaming';
}

export interface StableTerminalComposerSlot {
  visible: boolean;
  mode: 'edit' | 'queue' | 'approval';
  placeholder: string;
}

/**
 * Builds a stable terminal frame contract for Ink rendering.
 *
 * The kernel separates long-lived transcript content from the dynamic tail and
 * gives approval, activity, live-output and composer fixed semantic slots. UI
 * components can render these slots without re-deriving state in multiple
 * places, which reduces layout churn while the user is typing.
 */
export function buildStableTerminalFrame(input: StableTerminalFrameInput): StableTerminalFrame {
  const transcript = splitWorkbenchMessages(
    input.messages,
    input.runActive,
    input.dynamicMessageStartIndex
  );
  const hasApproval = Boolean(input.pendingApproval);

  return {
    transcript,
    slots: {
      activity: {
        visible: input.runActive && !input.inputDraftActive,
        reservedLines: input.runActive ? 1 : 0,
      },
      approval: {
        visible: hasApproval,
        anchor: 'above-composer',
        capturesKeyboard: hasApproval,
        help: 'Press a to approve, d to deny, Esc to cancel. No Enter needed.',
      },
      liveOutput: buildLiveOutputSlot(input),
      composer: buildComposerSlot(input.runActive, hasApproval),
    },
  };
}

function buildLiveOutputSlot(input: StableTerminalFrameInput): StableTerminalLiveOutputSlot {
  if (!input.liveOutputVisible) {
    return {
      visible: false,
      reservedLines: input.runActive ? 1 : 0,
      reason: 'not-streaming',
    };
  }

  if (input.inputDraftActive) {
    return {
      visible: false,
      reservedLines: 1,
      reason: 'input-draft-active',
    };
  }

  return {
    visible: true,
    reservedLines: 1,
  };
}

function buildComposerSlot(runActive: boolean, hasApproval: boolean): StableTerminalComposerSlot {
  if (hasApproval) {
    return {
      visible: true,
      mode: 'approval',
      placeholder: 'Approval pending: press a or d',
    };
  }

  if (runActive) {
    return {
      visible: true,
      mode: 'queue',
      placeholder: 'Queue a follow-up while the agent works',
    };
  }

  return {
    visible: true,
    mode: 'edit',
    placeholder: 'Type a request or "/" for commands',
  };
}
