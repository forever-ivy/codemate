import { describe, expect, it } from 'vitest';
import {
  EnterpriseRunGovernanceService,
  type EnterpriseRunAuditInput,
} from '../../../src/enterprise/EnterpriseRunGovernanceService';

describe('EnterpriseRunGovernanceService', () => {
  const service = new EnterpriseRunGovernanceService({
    rates: [
      {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        promptUsdPer1k: 0.001,
        completionUsdPer1k: 0.002,
      },
    ],
  });

  it('builds a stable audit record with cost and tool summary', () => {
    const record = service.buildAuditRecord(createInput());

    expect(record).toMatchObject({
      schemaVersion: 1,
      runId: 'run-121',
      tenant: {
        organizationId: 'org-1',
        workspaceId: 'workspace-1',
      },
      actor: {
        userId: 'user-1',
        source: 'cli',
      },
      project: {
        rootName: 'vite-project',
      },
      model: {
        provider: 'deepseek',
        model: 'deepseek-reasoner',
      },
      usage: {
        promptTokens: 2_000,
        completionTokens: 500,
        totalTokens: 2_500,
      },
      cost: {
        currency: 'USD',
        estimatedUsd: 0.003,
        rateSource: 'configured',
      },
      changes: {
        files: ['src/App.tsx', 'src/components/Sidebar.css'],
        count: 2,
      },
      tools: {
        total: 3,
        succeeded: 2,
        failed: 1,
        byName: {
          bash: 1,
          edit_file: 2,
        },
      },
      verification: {
        success: true,
        commandCount: 2,
      },
    });
  });

  it('evaluates managed policy limits against the audit record', () => {
    const record = service.buildAuditRecord(createInput());
    const decision = service.evaluateManagedPolicy(record, {
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      policyVersion: '2026-07',
      allowedProviders: ['openai'],
      maxPromptTokens: 1_000,
      maxRunCostUsd: 0.001,
      auditRetentionDays: 90,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.policyVersion).toBe('2026-07');
    expect(decision.violations).toEqual([
      {
        code: 'PROVIDER_NOT_ALLOWED',
        message: 'Provider deepseek is not in the managed allowlist.',
      },
      {
        code: 'PROMPT_TOKEN_LIMIT_EXCEEDED',
        message: 'Prompt tokens 2000 exceed managed limit 1000.',
      },
      {
        code: 'RUN_COST_LIMIT_EXCEEDED',
        message: 'Estimated run cost $0.003 exceeds managed limit $0.001.',
      },
    ]);
  });

  it('uses unknown cost rate when a model has no configured price', () => {
    const record = service.buildAuditRecord({
      ...createInput(),
      model: {
        provider: 'local',
        model: 'dev-model',
      },
    });

    expect(record.cost).toEqual({
      currency: 'USD',
      estimatedUsd: 0,
      rateSource: 'unknown',
    });
  });
});

function createInput(): EnterpriseRunAuditInput {
  return {
    runId: 'run-121',
    tenant: {
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
    },
    actor: {
      userId: 'user-1',
      source: 'cli',
    },
    project: {
      rootName: 'vite-project',
    },
    model: {
      provider: 'deepseek',
      model: 'deepseek-reasoner',
    },
    usage: {
      promptTokens: 2_000,
      completionTokens: 500,
      totalTokens: 2_500,
    },
    changedFiles: ['src/components/Sidebar.css', 'src/App.tsx', 'src/App.tsx'],
    tools: [
      {
        name: 'edit_file',
        ok: true,
        durationMs: 12,
      },
      {
        name: 'bash',
        ok: false,
        durationMs: 30,
      },
      {
        name: 'edit_file',
        ok: true,
        durationMs: 8,
      },
    ],
    verification: {
      success: true,
      commands: [
        { name: 'typecheck', success: true, durationMs: 1_200 },
        { name: 'test', success: true, durationMs: 2_000 },
      ],
    },
    timestamps: {
      startedAt: '2026-07-06T01:00:00.000Z',
      completedAt: '2026-07-06T01:00:05.000Z',
    },
  };
}
