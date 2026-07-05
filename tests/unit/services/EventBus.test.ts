import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../../src/services/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('on/emit', () => {
    it('should register and emit events', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      eventBus.emit('test.event', { data: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);

      eventBus.emit('test.event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not call handler if event not emitted', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);

      eventBus.emit('other.event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('off', () => {
    it('should remove event handler', () => {
      const handler = vi.fn();
      eventBus.on('test.event', handler);
      eventBus.off('test.event', handler);

      eventBus.emit('test.event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove specified handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);
      eventBus.off('test.event', handler1);

      eventBus.emit('test.event', { data: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('once', () => {
    it('should call handler only once', () => {
      const handler = vi.fn();
      eventBus.once('test.event', handler);

      eventBus.emit('test.event', { data: 'test1' });
      eventBus.emit('test.event', { data: 'test2' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'test1' });
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);
      eventBus.removeAllListeners('test.event');

      eventBus.emit('test.event', { data: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should remove all listeners for all events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on('event1', handler1);
      eventBus.on('event2', handler2);
      eventBus.removeAllListeners();

      eventBus.emit('event1', { data: 'test' });
      eventBus.emit('event2', { data: 'test' });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return correct listener count', () => {
      expect(eventBus.listenerCount('test.event')).toBe(0);

      eventBus.on('test.event', () => {});
      expect(eventBus.listenerCount('test.event')).toBe(1);

      eventBus.on('test.event', () => {});
      expect(eventBus.listenerCount('test.event')).toBe(2);
    });
  });

  describe('eventNames', () => {
    it('should return all event names', () => {
      eventBus.on('event1', () => {});
      eventBus.on('event2', () => {});

      const names = eventBus.eventNames();
      expect(names).toContain('event1');
      expect(names).toContain('event2');
      expect(names).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should not stop other handlers if one throws', () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = vi.fn();

      eventBus.on('test.event', handler1);
      eventBus.on('test.event', handler2);

      eventBus.emit('test.event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
