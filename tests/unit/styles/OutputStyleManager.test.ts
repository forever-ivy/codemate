import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OutputStyleManager } from '../../../src/styles/managers/OutputStyleManager';
import { Paths } from '../../../src/services/Paths';

describe('OutputStyleManager', () => {
  let tempDir: string;
  let paths: Paths;

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(process.cwd(), '.test-output-styles');
    fs.mkdirSync(tempDir, { recursive: true });

    // 创建 Paths 实例
    paths = new Paths({
      productName: 'aicli',
      cwd: tempDir,
    });
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should load builtin styles', () => {
    const manager = new OutputStyleManager({ paths });
    const styles = manager.list();

    expect(styles.length).toBeGreaterThan(0);
    expect(styles.some((s) => s.name === 'Default')).toBe(true);
    expect(styles.some((s) => s.name === 'Concise')).toBe(true);
    expect(styles.some((s) => s.name === 'Verbose')).toBe(true);
  });

  it('should get default style', () => {
    const manager = new OutputStyleManager({ paths });
    const style = manager.getDefaultOutputStyle();

    expect(style.name).toBe('Default');
    expect(style.isDefault()).toBe(true);
  });

  it('should get style by name', () => {
    const manager = new OutputStyleManager({ paths });
    const style = manager.getOutputStyle('Concise', tempDir);

    expect(style.name).toBe('Concise');
  });

  it('should throw error for unknown style', () => {
    const manager = new OutputStyleManager({ paths });

    expect(() => {
      manager.getOutputStyle('Unknown', tempDir);
    }).toThrow('Output style "Unknown" not found');
  });

  it('should load style from file', () => {
    const manager = new OutputStyleManager({ paths });

    // 创建样式文件
    const styleFile = path.join(tempDir, 'custom.md');
    fs.writeFileSync(
      styleFile,
      '---\ndescription: Custom style\nisCodingRelated: true\n---\n\nCustom prompt'
    );

    const style = manager.getOutputStyle('./custom.md', tempDir);

    expect(style.name).toBe('custom');
    expect(style.description).toBe('Custom style');
    expect(style.prompt).toBe('Custom prompt');
  });

  it('should load style from JSON', () => {
    const manager = new OutputStyleManager({ paths });

    const json = JSON.stringify({
      name: 'JSON Style',
      description: 'From JSON',
      isCodingRelated: true,
      prompt: 'JSON prompt',
    });

    const style = manager.getOutputStyle(json, tempDir);

    expect(style.name).toBe('JSON Style');
    expect(style.description).toBe('From JSON');
    expect(style.prompt).toBe('JSON prompt');
  });

  it('should list coding related styles', () => {
    const manager = new OutputStyleManager({ paths });
    const styles = manager.listCodingRelated();

    expect(styles.every((s) => s.isCodingRelated)).toBe(true);
  });
});
