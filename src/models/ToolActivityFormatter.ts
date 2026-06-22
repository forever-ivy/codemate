const TOOL_VERBS: Record<string, string> = {
  read_file: 'read',
  write_file: 'write',
  edit_file: 'edit',
  edit_code: 'edit_code',
  apply_patch: 'patch',
  list_files: 'list',
  grep: 'grep',
  glob: 'glob',
  bash: 'bash',
  exec: 'exec',
};

const MAX_TITLE_LENGTH = 72;

/**
 * Formats a provider tool call into a compact terminal activity title.
 *
 * 调用链路：
 * StreamingAgentRuntime -> AgentLoop -> AgentActivityReducer -> ToolActivityCard
 *
 * The formatter intentionally lives at the runtime boundary so the UI does not
 * need provider-specific knowledge about tool input shapes.
 */
export function formatToolActivityTitle(toolName: string, input?: unknown): string {
  const verb = TOOL_VERBS[toolName] ?? toolName;
  const args = asRecord(input);

  switch (toolName) {
    case 'read_file':
      return formatCall(verb, stringArg(args, 'path', 'file'));
    case 'write_file':
      return formatCall(verb, stringArg(args, 'path', 'file'));
    case 'edit_file':
      return formatCall(verb, stringArg(args, 'path', 'file'));
    case 'edit_code':
      return formatCall(verb, stringArg(args, 'path', 'file'));
    case 'apply_patch':
      return formatCall(verb, 'workspace files');
    case 'list_files':
      return formatCall(verb, stringArg(args, 'path', '.'));
    case 'grep': {
      const pattern = stringArg(args, 'pattern', '');
      const searchPath = stringArg(args, 'path', '.');
      return formatCall(verb, `"${pattern}" in ${searchPath}`);
    }
    case 'glob':
      return formatCall(verb, stringArg(args, 'pattern', '*'));
    case 'bash':
      return formatCall(verb, stringArg(args, 'command', 'command'));
    case 'exec': {
      const scriptPath = stringArg(args, 'scriptPath', 'script');
      const rawArgs = args.args;
      const suffix = Array.isArray(rawArgs) ? ` ${rawArgs.join(' ')}` : '';
      return formatCall(verb, `${scriptPath}${suffix}`.trim());
    }
    default:
      return formatCall(verb, input === undefined ? '...' : compactJson(input));
  }
}

function formatCall(name: string, value: string): string {
  return truncate(`${name}(${value})`, MAX_TITLE_LENGTH);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function stringArg(args: Record<string, unknown>, key: string, fallback: string): string {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function compactJson(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return '...';
  }
}
