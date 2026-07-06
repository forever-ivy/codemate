import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { AppContextProvider, useAppContext } from '../../../src/ui/context/AppContext';
import { Application } from '../../../src/application/Application';
import { ConfigService } from '../../../src/services/ConfigService';

describe('AppContext', () => {
  it('should provide context values', () => {
    const configService = new ConfigService({
      cwd: process.cwd(),
      productName: 'aicli',
    });
    const app = new Application(undefined, configService);

    let contextValue: any;

    function TestComponent() {
      contextValue = useAppContext();
      return null;
    }

    render(
      <AppContextProvider app={app}>
        <TestComponent />
      </AppContextProvider>
    );

    expect(contextValue).toBeDefined();
    expect(contextValue.app).toBe(app);
    expect(contextValue.currentSession).toBeNull();
    expect(contextValue.sessions).toEqual([]);
  });

  it('should throw error when used outside provider', () => {
    let error: Error | undefined;

    function TestComponent() {
      try {
        useAppContext();
      } catch (e) {
        error = e as Error;
      }
      return null;
    }

    render(<TestComponent />);

    expect(error).toBeDefined();
    expect(error?.message).toBe('useAppContext must be used within AppContextProvider');
  });
});
