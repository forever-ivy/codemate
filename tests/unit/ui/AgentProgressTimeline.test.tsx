import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { AgentProgressTimeline } from '../../../src/ui/components/AgentProgressTimeline';
import type { TaskItem } from '../../../src/ui/components/TaskTracker';
import { ThemeProvider } from '../../../src/ui/theme/ThemeSystem';

describe('AgentProgressTimeline', () => {
  it('should render categorized activity cards with status and details', () => {
    const tasks: TaskItem[] = [
      {
        id: 'run-plan-1',
        kind: 'plan',
        description: 'Inspect repository',
        status: 'completed',
        startTime: 1_000,
        endTime: 2_500,
      },
      {
        id: 'tool-edit-1',
        kind: 'tool',
        description: 'edit_file src/ui/App.tsx',
        status: 'failed',
        details: 'Tool requires user approval',
      },
      {
        id: 'verify-1',
        kind: 'verification',
        description: 'Running typecheck verification',
        status: 'running',
      },
    ];
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentProgressTimeline tasks={tasks} currentTask="Running typecheck verification" />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('Activity Timeline');
    expect(output).toMatch(/01\s+\[PLAN\]/);
    expect(output).toContain('PLAN');
    expect(output).toContain('TOOL');
    expect(output).toContain('VERIFY');
    expect(output).toContain('FAILED');
    expect(output).toContain('RUNNING');
    expect(output).toContain('Tool requires user approval');
    expect(output).toContain('1.5s');
  });

  it('renders at most three live activities without hidden-count churn', () => {
    const tasks: TaskItem[] = Array.from({ length: 5 }, (_, index) => ({
      id: `tool-${index}`,
      kind: 'tool',
      description: `read file ${index}`,
      status: 'completed',
    }));
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentProgressTimeline tasks={tasks} nowMs={3_000} />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).not.toContain('earlier activities hidden');
    expect(output).not.toContain('read file 1');
    expect(output).toContain('read file 4');
  });

  it('should render completed exploration bursts as a grouped phase', () => {
    const tasks: TaskItem[] = [
      {
        id: 'tool-read-1',
        kind: 'tool',
        description: 'read(package.json)',
        status: 'completed',
        startTime: 1_000,
        endTime: 1_050,
      },
      {
        id: 'tool-list-1',
        kind: 'tool',
        description: 'list(src)',
        status: 'completed',
        startTime: 1_100,
        endTime: 1_250,
      },
      {
        id: 'tool-grep-1',
        kind: 'tool',
        description: 'grep("UserIcon" in src)',
        status: 'completed',
        startTime: 1_300,
        endTime: 1_600,
      },
      {
        id: 'tool-edit-1',
        kind: 'tool',
        description: 'edit(src/App.tsx)',
        status: 'running',
        startTime: 1_700,
      },
    ];
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentProgressTimeline tasks={tasks} nowMs={3_000} />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('EXPLORE');
    expect(output).toContain('Explore completed');
    expect(output).toContain('3 tools');
    expect(output).toContain('edit(src/App.tsx)');
  });

  it('should render intent and completion events as first-class timeline activities', () => {
    const tasks: TaskItem[] = [
      {
        id: 'agent-run-1-intent',
        kind: 'intent',
        description: 'Classified run intent: code-change',
        status: 'completed',
      },
      {
        id: 'agent-run-1-incomplete',
        kind: 'result',
        description: 'Agent run did not meet completion conditions',
        status: 'failed',
        details: 'Expected file changes, but no files were changed.',
      },
    ];
    const { lastFrame } = render(
      <ThemeProvider>
        <AgentProgressTimeline tasks={tasks} />
      </ThemeProvider>
    );
    const output = lastFrame() ?? '';

    expect(output).toContain('INTENT');
    expect(output).toContain('RESULT');
    expect(output).toContain('code-change');
    expect(output).toContain('Expected file changes, but no files were changed.');
  });
});
