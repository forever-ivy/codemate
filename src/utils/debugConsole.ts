import { appendFileSync } from 'node:fs';
import { inspect } from 'node:util';

type ConsoleMethod = 'log' | 'debug' | 'info' | 'warn' | 'error';

export interface DebugConsoleOptions {
  enabled?: boolean;
  includeTimestamp?: boolean;
  logFile?: string;
  preserveOriginal?: boolean;
}

export interface InteractiveConsoleSilencerOptions {
  enabled?: boolean;
  includeTimestamp?: boolean;
  logFile?: string;
  methods?: ConsoleMethod[];
}

const methods: ConsoleMethod[] = ['log', 'debug', 'info', 'warn', 'error'];
const defaultSilencedMethods: ConsoleMethod[] = ['log', 'debug', 'info', 'warn', 'error'];
const originalConsole = Object.fromEntries(
  methods.map((method) => [method, console[method].bind(console)])
) as Record<ConsoleMethod, (...args: unknown[]) => void>;

let installed = false;
let silencerInstalled = false;
let silencedMethods: ConsoleMethod[] = [];
let activeLogFile: string | undefined;

export function isDebugConsoleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTruthy(env.CODEMATE_DEBUG_CONSOLE) || isTruthy(env.CODEMATE_DEBUG);
}

export function installDebugConsole(options: DebugConsoleOptions = {}): void {
  const enabled = options.enabled ?? isDebugConsoleEnabled();
  if (!enabled || installed) {
    return;
  }

  installed = true;
  activeLogFile = options.logFile || process.env.CODEMATE_DEBUG_LOG_FILE || '.codemate-debug.log';
  const preserveOriginal = options.preserveOriginal ?? true;

  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      if (preserveOriginal) {
        originalConsole[method](...args);
      }

      const line = formatDebugLine(method, args, options.includeTimestamp ?? true);
      process.stderr.write(`${line}\n`);

      if (activeLogFile) {
        appendFileSync(activeLogFile, `${line}\n`, 'utf-8');
      }
    };
  }

  console.info('[debug-console] Mirroring console output to stderr for Ink debugging.');
}

export function installInteractiveConsoleSilencer(
  options: InteractiveConsoleSilencerOptions = {}
): () => void {
  const enabled = options.enabled ?? (!isDebugConsoleEnabled() && Boolean(process.stdout.isTTY));
  if (!enabled) {
    return () => {};
  }

  const nextSilencedMethods = options.methods ?? defaultSilencedMethods;
  silencerInstalled = true;
  silencedMethods = nextSilencedMethods;
  activeLogFile = options.logFile || process.env.CODEMATE_DEBUG_LOG_FILE || activeLogFile;

  for (const method of silencedMethods) {
    console[method] = (...args: unknown[]) => {
      if (!activeLogFile) {
        return;
      }

      appendFileSync(
        activeLogFile,
        `${formatDebugLine(method, args, options.includeTimestamp ?? true)}\n`,
        'utf-8'
      );
    };
  }

  return restoreInteractiveConsoleSilencer;
}

export function restoreInteractiveConsoleSilencer(): void {
  if (!silencerInstalled) {
    return;
  }

  for (const method of silencedMethods) {
    console[method] = originalConsole[method] as (typeof console)[typeof method];
  }

  silencerInstalled = false;
  silencedMethods = [];
}

export function restoreDebugConsoleForTests(): void {
  restoreInteractiveConsoleSilencer();

  if (!installed) {
    return;
  }

  for (const method of methods) {
    console[method] = originalConsole[method] as (typeof console)[typeof method];
  }

  installed = false;
  activeLogFile = undefined;
}

export function writeDebugLog(label: string, payload?: unknown): void {
  if (!isDebugConsoleEnabled()) {
    return;
  }

  const logFile = activeLogFile || process.env.CODEMATE_DEBUG_LOG_FILE || '.codemate-debug.log';
  const message = payload === undefined ? label : `${label} ${formatArg(payload)}`;
  appendFileSync(logFile, `${formatDebugLine('debug', [message], true)}\n`, 'utf-8');
}

function formatDebugLine(
  method: ConsoleMethod,
  args: unknown[],
  includeTimestamp: boolean
): string {
  const prefix = includeTimestamp
    ? `[${new Date().toISOString()}] [console.${method}]`
    : `[console.${method}]`;
  const message = args.map(formatArg).join(' ');
  return `${prefix} ${message}`;
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return inspect(value, {
    colors: process.stderr.isTTY,
    depth: 5,
    breakLength: 120,
  });
}

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}
