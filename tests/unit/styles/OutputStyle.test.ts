import { describe, it, expect } from 'vitest';
import { OutputStyle } from '../../../src/styles/base/OutputStyle';

describe('OutputStyle', () => {
  it('should create output style', () => {
    const style = new OutputStyle({
      name: 'Test',
      description: 'Test style',
      isCodingRelated: true,
      prompt: 'Test prompt',
    });

    expect(style.name).toBe('Test');
    expect(style.description).toBe('Test style');
    expect(style.isCodingRelated).toBe(true);
    expect(style.prompt).toBe('Test prompt');
  });

  it('should identify default style', () => {
    const defaultStyle = new OutputStyle({
      name: 'Default',
      description: 'Default style',
      isCodingRelated: true,
      prompt: 'Default prompt',
    });

    const customStyle = new OutputStyle({
      name: 'Custom',
      description: 'Custom style',
      isCodingRelated: true,
      prompt: 'Custom prompt',
    });

    expect(defaultStyle.isDefault()).toBe(true);
    expect(customStyle.isDefault()).toBe(false);
  });
});
