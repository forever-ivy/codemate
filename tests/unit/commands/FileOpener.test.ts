import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileOpener } from '../../../src/commands/log/FileOpener.js';
import { platform } from 'os';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock os
vi.mock('os', () => ({
  platform: vi.fn(),
}));

describe('FileOpener', () => {
  let opener: FileOpener;

  beforeEach(() => {
    opener = new FileOpener();
    vi.clearAllMocks();
  });

  it('应该在 macOS 上使用 open 命令', async () => {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    vi.mocked(platform).mockReturnValue('darwin');
    mockExec.mockImplementation((cmd: string, callback: Function) => {
      if (cmd.includes('which open')) {
        callback(null, { stdout: '/usr/bin/open', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });

    await opener.openFile('/test/file.html');

    expect(mockExec).toHaveBeenCalledWith('which open', expect.any(Function));
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('open "/'), expect.any(Function));
  });

  it('应该在 Windows 上使用 start 命令', async () => {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    vi.mocked(platform).mockReturnValue('win32');
    mockExec.mockImplementation((_cmd: string, callback: Function) => {
      callback(null, { stdout: '', stderr: '' });
    });

    await opener.openFile('/test/file.html');

    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('start "" "'),
      expect.any(Function)
    );
  });

  it('应该在 Linux 上使用 xdg-open 命令', async () => {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    vi.mocked(platform).mockReturnValue('linux');
    mockExec.mockImplementation((cmd: string, callback: Function) => {
      if (cmd.includes('which xdg-open')) {
        callback(null, { stdout: '/usr/bin/xdg-open', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });

    await opener.openFile('/test/file.html');

    expect(mockExec).toHaveBeenCalledWith('which xdg-open', expect.any(Function));
    expect(mockExec).toHaveBeenCalledWith(
      expect.stringContaining('xdg-open "'),
      expect.any(Function)
    );
  });

  it('应该处理不支持的操作系统', async () => {
    vi.mocked(platform).mockReturnValue('unknown' as any);

    await expect(opener.openFile('/test/file.html')).rejects.toThrow('不支持的操作系统: unknown');
  });

  it('应该处理命令执行失败', async () => {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    vi.mocked(platform).mockReturnValue('darwin');
    mockExec.mockImplementation((cmd: string, callback: Function) => {
      if (cmd.includes('which open')) {
        // 模拟 which 命令成功，但 open 命令失败
        callback(null, { stdout: '/usr/bin/open', stderr: '' });
      } else {
        // 模拟 open 命令执行失败
        callback(new Error('Command failed'));
      }
    });

    await expect(opener.openFile('/test/file.html')).rejects.toThrow(
      '打开文件失败: Command failed'
    );
  });
});
