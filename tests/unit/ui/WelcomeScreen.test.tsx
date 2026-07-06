import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { WelcomeScreen } from '../../../src/ui/components/WelcomeScreen';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('WelcomeScreen', () => {
  it('keeps the idle welcome content compact enough for the dynamic terminal frame', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <WelcomeScreen version="v1.0.13" showTips={true} />
      </ThemeProvider>
    );

    const lines = (lastFrame() ?? '').split('\n');

    expect(lines.length).toBeLessThanOrEqual(10);
    expect(lastFrame()).toContain('CodeMate');
    expect(lastFrame()).not.toContain('██████');
  });
});
