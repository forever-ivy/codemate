export interface EnterpriseCostRate {
  provider: string;
  model: string;
  promptUsdPer1k: number;
  completionUsdPer1k: number;
}

export interface EnterpriseRunGovernanceOptions {
  rates?: EnterpriseCostRate[];
}

export interface EnterpriseManagedConfig {
  organizationId?: string;
  workspaceId?: string;
  policyVersion?: string;
  allowedProviders?: string[];
  maxPromptTokens?: number;
  maxRunCostUsd?: number;
  auditRetentionDays?: number;
}

export interface EnterpriseRunAuditInput {
  runId: string;
  tenant?: {
    organizationId?: string;
    workspaceId?: string;
  };
  actor?: {
    userId?: string;
    source: 'cli' | 'headless' | 'ci' | 'api';
  };
  project?: {
    rootName?: string;
    repository?: string;
  };
  model: {
    provider: string;
    model: string;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  changedFiles?: string[];
  tools?: EnterpriseToolAuditInput[];
  verification?: {
    success: boolean;
    commands: Array<{
      name: string;
      success: boolean;
      durationMs?: number;
    }>;
  };
  timestamps?: {
    startedAt?: string;
    completedAt?: string;
  };
}

export interface EnterpriseToolAuditInput {
  name: string;
  ok: boolean;
  durationMs?: number;
}

export interface EnterpriseRunAuditRecord {
  schemaVersion: 1;
  runId: string;
  tenant: {
    organizationId?: string;
    workspaceId?: string;
  };
  actor: {
    userId?: string;
    source: 'cli' | 'headless' | 'ci' | 'api';
  };
  project: {
    rootName?: string;
    repository?: string;
  };
  model: {
    provider: string;
    model: string;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    currency: 'USD';
    estimatedUsd: number;
    rateSource: 'configured' | 'unknown';
  };
  changes: {
    files: string[];
    count: number;
  };
  tools: {
    total: number;
    succeeded: number;
    failed: number;
    byName: Record<string, number>;
    totalDurationMs: number;
  };
  verification?: {
    success: boolean;
    commandCount: number;
    failedCommands: string[];
    totalDurationMs: number;
  };
  timestamps: {
    startedAt?: string;
    completedAt?: string;
  };
}

export interface EnterprisePolicyDecision {
  allowed: boolean;
  policyVersion: string;
  auditRetentionDays?: number;
  violations: EnterprisePolicyViolation[];
}

export interface EnterprisePolicyViolation {
  code: 'PROVIDER_NOT_ALLOWED' | 'PROMPT_TOKEN_LIMIT_EXCEEDED' | 'RUN_COST_LIMIT_EXCEEDED';
  message: string;
}

/**
 * EnterpriseRunGovernanceService builds deterministic audit records for agent runs.
 *
 * It intentionally stays pure and storage-free: the caller can write the returned
 * record to JSONL, ship it to a managed control plane, or feed it into CI gates.
 */
export class EnterpriseRunGovernanceService {
  private rates: EnterpriseCostRate[];

  constructor(options: EnterpriseRunGovernanceOptions = {}) {
    this.rates = options.rates ?? [];
  }

  buildAuditRecord(input: EnterpriseRunAuditInput): EnterpriseRunAuditRecord {
    const usage = input.usage ?? {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    const cost = this.estimateCost(input.model.provider, input.model.model, usage);
    const changedFiles = this.uniqueSorted(input.changedFiles ?? []);

    return {
      schemaVersion: 1,
      runId: input.runId,
      tenant: {
        ...(input.tenant?.organizationId ? { organizationId: input.tenant.organizationId } : {}),
        ...(input.tenant?.workspaceId ? { workspaceId: input.tenant.workspaceId } : {}),
      },
      actor: {
        ...(input.actor?.userId ? { userId: input.actor.userId } : {}),
        source: input.actor?.source ?? 'cli',
      },
      project: {
        ...(input.project?.rootName ? { rootName: input.project.rootName } : {}),
        ...(input.project?.repository ? { repository: input.project.repository } : {}),
      },
      model: input.model,
      usage,
      cost,
      changes: {
        files: changedFiles,
        count: changedFiles.length,
      },
      tools: this.summarizeTools(input.tools ?? []),
      ...(input.verification
        ? { verification: this.summarizeVerification(input.verification) }
        : {}),
      timestamps: {
        ...(input.timestamps?.startedAt ? { startedAt: input.timestamps.startedAt } : {}),
        ...(input.timestamps?.completedAt ? { completedAt: input.timestamps.completedAt } : {}),
      },
    };
  }

  evaluateManagedPolicy(
    record: EnterpriseRunAuditRecord,
    managedConfig: EnterpriseManagedConfig
  ): EnterprisePolicyDecision {
    const violations: EnterprisePolicyViolation[] = [];

    if (
      managedConfig.allowedProviders?.length &&
      !managedConfig.allowedProviders.includes(record.model.provider)
    ) {
      violations.push({
        code: 'PROVIDER_NOT_ALLOWED',
        message: `Provider ${record.model.provider} is not in the managed allowlist.`,
      });
    }

    if (
      managedConfig.maxPromptTokens !== undefined &&
      record.usage.promptTokens > managedConfig.maxPromptTokens
    ) {
      violations.push({
        code: 'PROMPT_TOKEN_LIMIT_EXCEEDED',
        message: `Prompt tokens ${record.usage.promptTokens} exceed managed limit ${managedConfig.maxPromptTokens}.`,
      });
    }

    if (
      managedConfig.maxRunCostUsd !== undefined &&
      record.cost.estimatedUsd > managedConfig.maxRunCostUsd
    ) {
      violations.push({
        code: 'RUN_COST_LIMIT_EXCEEDED',
        message: `Estimated run cost $${record.cost.estimatedUsd} exceeds managed limit $${managedConfig.maxRunCostUsd}.`,
      });
    }

    return {
      allowed: violations.length === 0,
      policyVersion: managedConfig.policyVersion ?? 'local',
      ...(managedConfig.auditRetentionDays !== undefined
        ? { auditRetentionDays: managedConfig.auditRetentionDays }
        : {}),
      violations,
    };
  }

  estimateCost(
    provider: string,
    model: string,
    usage: NonNullable<EnterpriseRunAuditInput['usage']>
  ): EnterpriseRunAuditRecord['cost'] {
    const rate = this.rates.find(
      (candidate) => candidate.provider === provider && candidate.model === model
    );

    if (!rate) {
      return {
        currency: 'USD',
        estimatedUsd: 0,
        rateSource: 'unknown',
      };
    }

    const estimatedUsd =
      (usage.promptTokens / 1_000) * rate.promptUsdPer1k +
      (usage.completionTokens / 1_000) * rate.completionUsdPer1k;

    return {
      currency: 'USD',
      estimatedUsd: this.roundCurrency(estimatedUsd),
      rateSource: 'configured',
    };
  }

  private summarizeTools(tools: EnterpriseToolAuditInput[]): EnterpriseRunAuditRecord['tools'] {
    const byName: Record<string, number> = {};
    let succeeded = 0;
    let failed = 0;
    let totalDurationMs = 0;

    for (const tool of tools) {
      byName[tool.name] = (byName[tool.name] ?? 0) + 1;
      totalDurationMs += tool.durationMs ?? 0;
      if (tool.ok) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    return {
      total: tools.length,
      succeeded,
      failed,
      byName: this.sortRecord(byName),
      totalDurationMs,
    };
  }

  private summarizeVerification(
    verification: NonNullable<EnterpriseRunAuditInput['verification']>
  ): NonNullable<EnterpriseRunAuditRecord['verification']> {
    return {
      success: verification.success,
      commandCount: verification.commands.length,
      failedCommands: verification.commands
        .filter((command) => !command.success)
        .map((command) => command.name)
        .sort(),
      totalDurationMs: verification.commands.reduce(
        (total, command) => total + (command.durationMs ?? 0),
        0
      ),
    };
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }

  private sortRecord(record: Record<string, number>): Record<string, number> {
    return Object.fromEntries(
      Object.entries(record).sort(([left], [right]) => left.localeCompare(right))
    );
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(6));
  }
}
