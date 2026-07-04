import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExitCommand } from '../../../src/commands/session/ExitCommand';
import type { Application } from '../../../src/application/Application';
import type { EventBus } from '../../../src/services/EventBus';

describe('ExitCommand', () => {
  let exitCommand: ExitCommand;
  let mockApp: Application;
  let mockEventBus: EventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      listenerCount: vi.fn(),
    } as any;

    mockApp = {
      stop: vi.fn().mockResolvedValue(undefined),
      getContainer: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(mockEventBus),
      }),
    } as any;

    exitCommand = new ExitCommand();
  });

  it('should emit an exit event when the UI is listening', async () => {
    (mockEventBus.listenerCount as any).mockReturnValue(1);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await exitCommand.execute([], mockApp);

    expect(mockEventBus.emit).toHaveBeenCalledWith('exit_app');
    expect(mockApp.stop).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should stop the app and exit the process when no UI listener exists', async () => {
    (mockEventBus.listenerCount as any).mockReturnValue(0);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    await exitCommand.execute([], mockApp);

    expect(mockApp.stop).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
