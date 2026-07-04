import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigCommand } from '../../../src/commands/config/ConfigCommand';
import type { Application } from '../../../src/application/Application';
import type { ConfigService } from '../../../src/services/ConfigService';
import type { SessionService } from '../../../src/services/SessionService';

describe('ConfigCommand', () => {
  let configCommand: ConfigCommand;
  let mockApp: Application;
  let mockConfigService: ConfigService;
  let mockSessionService: SessionService;

  beforeEach(() => {
    mockConfigService = {
      setConfig: vi.fn(),
      getConfigValue: vi.fn(),
      addConfig: vi.fn(),
      removeConfig: vi.fn(),
      getEnhancedConfig: vi.fn().mockReturnValue({ model: 'deepseek-chat' }),
      getConfig: vi.fn().mockReturnValue({ model: 'deepseek-chat' }),
    } as any;

    mockSessionService = {
      addMessage: vi.fn().mockResolvedValue(undefined),
    } as any;

    const containerGet = vi.fn((serviceName: string) => {
      if (serviceName === 'config') return mockConfigService;
      if (serviceName === 'session') return mockSessionService;
      return undefined;
    });

    mockApp = {
      getContainer: vi.fn().mockReturnValue({
        get: containerGet,
      }),
    } as any;

    configCommand = new ConfigCommand();
  });

  it('should show help in the session when no action is provided', async () => {
    await configCommand.execute([], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('Config Command Usage:'),
      })
    );
  });

  it('should write config values and report the result in the session', async () => {
    await configCommand.execute(['set', 'model', 'gpt-4o'], mockApp);

    expect(mockConfigService.setConfig).toHaveBeenCalledWith(false, 'model', 'gpt-4o');
    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: '✅ Config set: model = "gpt-4o"',
      })
    );
  });

  it('should list configuration in the session', async () => {
    await configCommand.execute(['list'], mockApp);

    expect(mockSessionService.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: expect.stringContaining('deepseek-chat'),
      })
    );
  });
});
