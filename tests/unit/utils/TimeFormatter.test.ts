import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeFormatter } from '../../../src/utils/timeFormatter';

describe('TimeFormatter', () => {
  beforeEach(() => {
    // Mock current time to 2024-01-01T12:00:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    it('should format seconds ago', () => {
      const date = new Date('2024-01-01T11:59:30Z'); // 30 seconds ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('30s ago');
    });

    it('should format minutes ago', () => {
      const date = new Date('2024-01-01T11:55:00Z'); // 5 minutes ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const date = new Date('2024-01-01T10:00:00Z'); // 2 hours ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('2h ago');
    });

    it('should format days ago', () => {
      const date = new Date('2023-12-30T12:00:00Z'); // 2 days ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('2 days ago');
    });

    it('should format single day ago', () => {
      const date = new Date('2023-12-31T12:00:00Z'); // 1 day ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('1 day ago');
    });

    it('should format weeks ago', () => {
      const date = new Date('2023-12-18T12:00:00Z'); // 2 weeks ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('2 weeks ago');
    });

    it('should format months ago', () => {
      const date = new Date('2023-11-01T12:00:00Z'); // 2 months ago
      const result = TimeFormatter.formatRelativeTime(date);
      expect(result).toBe('2 months ago');
    });
  });

  describe('formatAbsoluteTime', () => {
    it('should format absolute time correctly', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const result = TimeFormatter.formatAbsoluteTime(date);
      expect(result).toMatch(/Jan 15, 2024/);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds to duration', () => {
      expect(TimeFormatter.formatDuration(5000)).toBe('5s');
      expect(TimeFormatter.formatDuration(65000)).toBe('1m 5s');
      expect(TimeFormatter.formatDuration(3665000)).toBe('1h 1m');
    });
  });
});
