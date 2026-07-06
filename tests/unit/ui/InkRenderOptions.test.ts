import { describe, expect, it } from 'vitest';
import { createInkRenderOptions } from '../../../src/ui/InkRenderOptions';

describe('InkRenderOptions', () => {
  it('should keep console output from corrupting the interactive frame', () => {
    expect(createInkRenderOptions()).toMatchObject({
      patchConsole: false,
      exitOnCtrlC: false,
      incrementalRendering: true,
      maxFps: 30,
    });
  });
});
