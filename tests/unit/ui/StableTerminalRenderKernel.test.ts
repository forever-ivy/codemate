import { describe, expect, it } from 'vitest';
import type { EnhancedMessage } from '../../../src/types/index';
import {
  buildStableTerminalFrame,
  type StableTerminalFrameInput,
} from '../../../src/ui/workbench/StableTerminalRenderKernel';

describe('StableTerminalRenderKernel', () => {
  it('keeps completed transcript static and current turn dynamic while running', () => {
    const frame = buildStableTerminalFrame(
      createInput({
        messages: [message('user', 'old'), message('assistant', 'done'), message('user', 'now')],
        runActive: true,
        dynamicMessageStartIndex: 2,
      })
    );

    expect(frame.transcript.completedMessages.map(text)).toEqual(['old', 'done']);
    expect(frame.transcript.pendingMessages.map(text)).toEqual(['now']);
    expect(frame.slots.activity.visible).toBe(true);
    expect(frame.slots.composer.mode).toBe('queue');
    expect(frame.slots.composer.placeholder).toBe('Queue a follow-up while the agent works');
  });

  it('anchors approval above the composer and captures approval keys', () => {
    const frame = buildStableTerminalFrame(
      createInput({
        runActive: true,
        pendingApproval: true,
      })
    );

    expect(frame.slots.approval).toEqual({
      visible: true,
      anchor: 'above-composer',
      capturesKeyboard: true,
      help: 'Press a to approve, d to deny, Esc to cancel. No Enter needed.',
    });
    expect(frame.slots.composer.mode).toBe('approval');
    expect(frame.slots.composer.placeholder).toBe('Approval pending: press a or d');
  });

  it('hides live output during typing to protect the input line', () => {
    const frame = buildStableTerminalFrame(
      createInput({
        runActive: true,
        liveOutputVisible: true,
        inputDraftActive: true,
      })
    );

    expect(frame.slots.liveOutput).toEqual({
      visible: false,
      reservedLines: 1,
      reason: 'input-draft-active',
    });
    expect(frame.slots.activity).toEqual({
      visible: false,
      reservedLines: 1,
    });
  });

  it('returns to editable composer when idle', () => {
    const frame = buildStableTerminalFrame(
      createInput({
        runActive: false,
        messages: [message('user', 'request'), message('assistant', 'answer')],
      })
    );

    expect(frame.transcript.completedMessages.map(text)).toEqual(['request', 'answer']);
    expect(frame.transcript.pendingMessages).toEqual([]);
    expect(frame.slots.activity.visible).toBe(false);
    expect(frame.slots.approval.visible).toBe(false);
    expect(frame.slots.composer).toEqual({
      visible: true,
      mode: 'edit',
      placeholder: 'Type a request or "/" for commands',
    });
  });
});

function createInput(overrides: Partial<StableTerminalFrameInput> = {}): StableTerminalFrameInput {
  return {
    messages: [],
    runActive: false,
    dynamicMessageStartIndex: undefined,
    pendingApproval: false,
    liveOutputVisible: false,
    inputDraftActive: false,
    ...overrides,
  };
}

function message(role: 'user' | 'assistant', content: string): EnhancedMessage {
  return {
    uuid: `${role}-${content}`,
    parentUuid: null,
    role,
    content,
    timestamp: 1,
  };
}

function text(message: EnhancedMessage): string {
  return typeof message.content === 'string' ? message.content : '';
}
