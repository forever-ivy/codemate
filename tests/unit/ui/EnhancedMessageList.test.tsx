import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import type { EnhancedMessage } from '../../../src/types/index';
import { EnhancedMessageList } from '../../../src/ui/components/EnhancedMessageList';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('EnhancedMessageList', () => {
  it('should render assistant markdown semantically', () => {
    const messages: EnhancedMessage[] = [
      {
        uuid: 'assistant-1',
        parentUuid: null,
        role: 'assistant',
        content: '## 当前项目\n\n- **TypeScript** 终端 UI',
        timestamp: 1,
      },
    ];
    const { lastFrame } = render(
      <ThemeProvider>
        <EnhancedMessageList messages={messages} />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('当前项目');
    expect(output).toContain('TypeScript');
    expect(output).not.toContain('##');
    expect(output).not.toContain('**');
  });
});
