import type { LiveModelOutputState } from '../components/LiveModelOutput';

export interface LiveModelOutputViewModel {
  title: string;
  meta: string;
  preview: string;
}

const MAX_PREVIEW_CHARS = 140;

/**
 * Builds a bounded live-output presentation model.
 *
 * The live panel is intentionally not a transcript. It gives the user a stable
 * signal that the model is working without streaming raw markdown into Ink.
 */
export function buildLiveModelOutputViewModel(
  output?: LiveModelOutputState
): LiveModelOutputViewModel | undefined {
  if (!output) {
    return undefined;
  }

  const title = stageTitle(output);
  if (output.stage === 'tool') {
    return {
      title,
      meta: 'active tool',
      preview: 'Tool is running',
    };
  }

  if (output.stage === 'step') {
    return {
      title,
      meta: 'runtime step',
      preview: 'Model step completed',
    };
  }

  if (output.stage === 'failed' || output.stage === 'cancelled') {
    return {
      title,
      meta: output.stage,
      preview: output.stage === 'failed' ? 'Run failed' : 'Run cancelled',
    };
  }

  const content =
    output.stage === 'text' ? output.text || output.reasoning : output.reasoning || output.text;
  const preview = compactPreview(content);

  return {
    title,
    meta: `${formatCharCount(content.length)} chars`,
    preview: preview || 'Waiting for model output',
  };
}

function stageTitle(output: LiveModelOutputState): string {
  switch (output.stage) {
    case 'reasoning':
      return 'Thinking';
    case 'text':
      return 'Responding';
    case 'tool':
      return output.toolName ? `Running ${output.toolName}` : 'Running tool';
    case 'step':
      return 'Step completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return output.reasoning ? 'Thinking' : output.text ? 'Responding' : 'Working';
  }
}

function compactPreview(content: string): string {
  const sanitized = stripMarkdown(content).replace(/\s+/g, ' ').trim();

  if (sanitized.length <= MAX_PREVIEW_CHARS) {
    return sanitized;
  }

  return `${sanitized.slice(0, MAX_PREVIEW_CHARS - 3).trimEnd()}...`;
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function formatCharCount(count: number): string {
  if (count < 1_000) {
    return String(count);
  }

  return `${(count / 1_000).toFixed(1)}k`;
}
