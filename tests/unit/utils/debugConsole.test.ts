import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installDebugConsole,
  installInteractiveConsoleSilencer,
  isDebugConsoleEnabled,
  restoreDebugConsoleForTests,
} from '../../../src/utils/debugConsole';

describe('debugConsole', () => {
  afterEach(() => {
    restoreDebugConsoleForTests();
    vi.restoreAllMocks();
  });

  it('should be disabled by default', () => {
    expect(isDebugConsoleEnabled({})).toBe(false);
  });

  it('should detect enabled debug console environment variables', () => {
    expect(isDebugConsoleEnabled({ CODEMATE_DEBUG_CONSOLE: '1' })).toBe(true);
    expect(isDebugConsoleEnabled({ CODEMATE_DEBUG: 'true' })).toBe(true);
  });

  it('should mirror console output to stderr when enabled', () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    installDebugConsole({
      enabled: true,
      includeTimestamp: false,
      preserveOriginal: false,
    });

    console.log('hello', { value: 1 });

    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('[console.log] hello'));
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining('value: 1'));
  });

  it('should silence regular console output in interactive mode', () => {
    const originalWarn = console.warn;
    const originalError = console.error;
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const restore = installInteractiveConsoleSilencer({
      enabled: true,
      logFile: undefined,
    });

    console.log('startup noise');
    console.info('service registered');
    console.warn('runtime warning');
    console.error('runtime error');

    expect(console.warn).not.toBe(originalWarn);
    expect(console.error).not.toBe(originalError);
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).not.toHaveBeenCalled();

    restore();
  });

  it('should restore console output after interactive silencing', () => {
    const originalLog = console.log;
    const restore = installInteractiveConsoleSilencer({
      enabled: true,
      logFile: undefined,
    });

    expect(console.log).not.toBe(originalLog);

    restore();

    expect(console.log).toBe(originalLog);
  });

  it('should reapply silencing when another renderer replaces console methods', () => {
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const restore = installInteractiveConsoleSilencer({
      enabled: true,
      logFile: undefined,
    });

    console.log = (...args: unknown[]) => {
      process.stdout.write(`${args.join(' ')}\n`);
    };

    installInteractiveConsoleSilencer({
      enabled: true,
      logFile: undefined,
    });
    console.log('renderer noise');

    expect(stdoutWrite).not.toHaveBeenCalled();

    restore();
  });

  it('should leave console output alone when interactive silencing is disabled', () => {
    const originalLog = console.log;

    installInteractiveConsoleSilencer({
      enabled: false,
    });

    expect(console.log).toBe(originalLog);
  });
});
