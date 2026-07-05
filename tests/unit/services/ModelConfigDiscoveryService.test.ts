import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigService } from '../../../src/services/ConfigService';
import { ModelConfigDiscoveryService } from '../../../src/services/ModelConfigDiscoveryService';

describe('ModelConfigDiscoveryService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('discovers supported providers from environment variables', () => {
    const service = new ModelConfigDiscoveryService({
      DEEPSEEK_API_KEY: 'deepseek-key',
      DEEPSEEK_MODEL: 'deepseek-reasoner',
      GLM_API_KEY: 'glm-key',
    });

    const providers = service.discoverFromEnvironment();

    expect(providers.map((provider) => provider.providerId)).toEqual(['deepseek', 'glm']);
    expect(providers[0]).toMatchObject({
      providerId: 'deepseek',
      model: 'deepseek-reasoner',
      baseURL: 'https://api.deepseek.com',
      ready: true,
    });
    expect(providers[1]).toMatchObject({
      providerId: 'glm',
      model: 'glm-4-plus',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      ready: true,
    });
  });

  it('uses discovered DeepSeek environment config when no provider is configured', () => {
    const previousKey = process.env.DEEPSEEK_API_KEY;
    const previousModel = process.env.DEEPSEEK_MODEL;
    process.env.DEEPSEEK_API_KEY = 'env-deepseek-key';
    process.env.DEEPSEEK_MODEL = 'deepseek-reasoner';

    try {
      const configService = new ConfigService({
        cwd: process.cwd(),
        productName: 'codemate-test-env',
      });

      expect(configService.getModelConfig()).toMatchObject({
        apiKey: 'env-deepseek-key',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-reasoner',
      });
      expect(configService.getModelDoctorReport()).toMatchObject({
        activeProviderId: 'deepseek',
        hasApiKey: true,
      });
    } finally {
      restoreEnv('DEEPSEEK_API_KEY', previousKey);
      restoreEnv('DEEPSEEK_MODEL', previousModel);
    }
  });

  it('imports a discovered provider into project config', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'codemate-config-'));
    const previousKey = process.env.GLM_API_KEY;
    const previousModel = process.env.GLM_MODEL;
    process.env.GLM_API_KEY = 'glm-env-key';
    process.env.GLM_MODEL = 'glm-4-plus';

    try {
      const configService = new ConfigService({
        cwd: tempDir,
        productName: 'codemate',
      });

      const message = configService.importDiscoveredProvider('glm');
      const configPath = path.join(tempDir, '.codemate', 'config.json');
      const savedConfig = JSON.parse(await readFile(configPath, 'utf-8'));

      expect(message).toContain('Imported GLM');
      expect(savedConfig).toMatchObject({
        model: 'glm-4-plus',
        provider: {
          glm: {
            apiKey: 'glm-env-key',
            baseURL: 'https://open.bigmodel.cn/api/paas/v4',
          },
        },
      });
      expect(savedConfig._metadata.provider).toBe('glm');
    } finally {
      restoreEnv('GLM_API_KEY', previousKey);
      restoreEnv('GLM_MODEL', previousModel);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
