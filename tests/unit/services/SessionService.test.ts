import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionService } from '../../../src/services/SessionService';
import { Paths } from '../../../src/services/Paths';
import { EventBus } from '../../../src/services/EventBus';
import { EventType } from '../../../src/types/index';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('SessionService', () => {
  let sessionService: SessionService;
  let paths: Paths;
  let eventBus: EventBus;
  const testDir = path.join(process.cwd(), 'test-sessions');

  beforeEach(async () => {
    paths = new Paths({
      productName: 'test-aicli',
      cwd: testDir,
    });
    eventBus = new EventBus();
    sessionService = new SessionService(paths, eventBus);
    await sessionService.initialize();
  });

  afterEach(() => {
    try {
      fs.rmSync(paths.globalProjectDir, { recursive: true, force: true });
    } catch {}
  });

  // ... 原有测试 ...

  describe('events', () => {
    it('should emit session.created event', async () => {
      const handler = vi.fn();
      eventBus.on(EventType.SESSION_CREATED, handler);

      const session = await sessionService.create('Test Session');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        session,
        timestamp: expect.any(Number),
      });
    });

    it('should emit session.loaded event', async () => {
      const handler = vi.fn();
      const created = await sessionService.create('Test');

      eventBus.on(EventType.SESSION_LOADED, handler);
      await sessionService.load(created.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit message.sent event', async () => {
      const handler = vi.fn();
      await sessionService.create('Test');

      eventBus.on(EventType.MESSAGE_SENT, handler);
      await sessionService.addMessage({
        role: 'user',
        content: 'Hello',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        message: { role: 'user', content: 'Hello' },
        sessionId: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('should emit session.saved event after adding message', async () => {
      const handler = vi.fn();
      await sessionService.create('Test');

      eventBus.on(EventType.SESSION_SAVED, handler);
      await sessionService.addMessage({
        role: 'user',
        content: 'Hello',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should emit session.deleted event', async () => {
      const handler = vi.fn();
      const session = await sessionService.create('Test');

      eventBus.on(EventType.SESSION_DELETED, handler);
      await sessionService.delete(session.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
