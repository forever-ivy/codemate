import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasUsableConfig, isFirstRun } from '../../../src/utils/firstRun';

describe('firstRun', () => {
  const configPath = '/tmp/codemate/config.json';
  const legacyConfigPath = '/tmp/codemate/.aiclirc.json';

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should treat missing config files as first run', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(isFirstRun()).toBe(true);
  });

  it('should treat invalid config json as unusable', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (filePath: fs.PathLike) => filePath === configPath
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => '{invalid-json');

    expect(hasUsableConfig(configPath, legacyConfigPath)).toBe(false);
  });

  it('should require a configured model', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (filePath: fs.PathLike) => filePath === configPath
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() =>
      JSON.stringify({
        provider: {
          deepseek: {
            apiKey: 'sk-test',
          },
        },
        _metadata: {
          provider: 'deepseek',
        },
      })
    );

    expect(hasUsableConfig(configPath, legacyConfigPath)).toBe(false);
  });

  it('should require an api key when no environment fallback exists', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (filePath: fs.PathLike) => filePath === configPath
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() =>
      JSON.stringify({
        model: 'deepseek-chat',
        provider: {
          deepseek: {},
        },
        _metadata: {
          provider: 'deepseek',
        },
      })
    );

    expect(hasUsableConfig(configPath, legacyConfigPath)).toBe(false);
  });

  it('should accept environment api key as fallback', () => {
    process.env.DEEPSEEK_API_KEY = 'env-deepseek-key';

    vi.spyOn(fs, 'existsSync').mockImplementation(
      (filePath: fs.PathLike) => filePath === configPath
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() =>
      JSON.stringify({
        model: 'deepseek-chat',
        provider: {
          deepseek: {},
        },
        _metadata: {
          provider: 'deepseek',
        },
      })
    );

    expect(hasUsableConfig(configPath, legacyConfigPath)).toBe(true);
  });

  it('should accept a valid config file', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (filePath: fs.PathLike) => filePath === configPath
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation(() =>
      JSON.stringify({
        model: 'deepseek-chat',
        provider: {
          deepseek: {
            apiKey: 'sk-live',
          },
        },
        _metadata: {
          provider: 'deepseek',
        },
      })
    );

    expect(hasUsableConfig(configPath, legacyConfigPath)).toBe(true);
  });
});
