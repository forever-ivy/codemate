import type { AgentRuntimeEvent } from '@/agents/AgentRuntimeEvent';
import { ModelProviderFactory } from '@/models/ModelProviderFactory';
import { StreamingAgentRuntime } from '@/models/StreamingAgentRuntime';
import type { ModelConfig } from '@/types/index';
import { tool } from 'ai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const runIfConfigured = process.env.DEEPSEEK_API_KEY ? it : it.skip;

describe('DeepSeek streaming runtime smoke test', () => {
  runIfConfigured(
    'streams DeepSeek progress and closes the run',
    async () => {
      const runtime = new StreamingAgentRuntime();
      const descriptor = new ModelProviderFactory().create(createDeepSeekConfig());
      const events: AgentRuntimeEvent[] = [];

      const result = await runtime.execute({
        runId: 'deepseek-smoke',
        descriptor,
        system: [
          'You are running inside the repository root.',
          'You must call the list_files tool exactly once with path "." before answering.',
          'After the tool returns, report the first entry only.',
        ].join(' '),
        prompt: 'List the current directory and report the first entry.',
        tools: {
          list_files: createReadOnlyListFilesTool(),
        },
        onEvent: (event) => events.push(event),
      });

      expect(
        events.some((event) => event.type === 'reasoning_delta' || event.type === 'text_delta')
      ).toBe(true);
      expect(events.some((event) => event.type === 'tool_completed')).toBe(true);
      expect(events.at(-1)?.type).toBe('model_completed');
      expect(result.text.trim()).not.toBe('');
    },
    60_000
  );
});

function createDeepSeekConfig(): ModelConfig {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
    temperature: 0,
  };
}

function createReadOnlyListFilesTool() {
  return tool({
    description: 'List files in a directory relative to the current working directory.',
    inputSchema: z.object({
      path: z.string().describe('Relative directory path. Use "." for the current directory.'),
    }),
    execute: async ({ path: relativePath }) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });

      return {
        entries: entries
          .map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? ('directory' as const) : ('file' as const),
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      };
    },
  });
}
