import * as fs from 'node:fs';
import { resolve } from 'pathe';
import { defineConfig } from 'vitest/config';

interface TestQuarantineManifest {
  version: number;
  entries: Array<{ file: string }>;
}

const quarantinePath = resolve(__dirname, 'config/test-quarantine.json');
const quarantine = JSON.parse(fs.readFileSync(quarantinePath, 'utf8')) as TestQuarantineManifest;

if (quarantine.version !== 1) {
  throw new Error(`Unsupported test quarantine version: ${quarantine.version}`);
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/fixtures/**',
      ...quarantine.entries.map((entry) => entry.file),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
