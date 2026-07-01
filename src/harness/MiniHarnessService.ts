import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'pathe';
import type { VerificationResult } from '../verification/VerificationService';

export interface MiniHarnessTask {
  id: string;
  title: string;
  description?: string;
  fixtureDir: string;
  userMessage: string;
  expected: MiniHarnessExpectation;
}

export interface MiniHarnessExpectation {
  agentSuccess?: boolean;
  modelInputIncludes?: string[];
  changedFiles?: string[];
  verificationSuccess?: boolean;
  responseIncludes?: string[];
}

export interface MiniHarnessAgentRequest {
  task: MiniHarnessTask;
  workspaceDir: string;
}

export interface MiniHarnessAgentRun {
  success: boolean;
  modelInput?: string;
  responseContent?: string;
  changedFiles?: string[];
  verification?: Pick<VerificationResult, 'success' | 'summary'>;
}

export type MiniHarnessAgentRunner = (
  request: MiniHarnessAgentRequest
) => Promise<MiniHarnessAgentRun>;

export interface MiniHarnessCheck {
  name: string;
  success: boolean;
  expected: string;
  actual: string;
}

export interface MiniHarnessTaskResult {
  taskId: string;
  title: string;
  success: boolean;
  workspaceDir: string;
  checks: MiniHarnessCheck[];
  agentRun?: MiniHarnessAgentRun;
  error?: string;
}

export interface MiniHarnessOptions {
  workspaceRoot?: string;
  keepWorkspaces?: boolean;
}

/**
 * MiniHarnessService 运行轻量任务级验收。
 *
 * 调用链路：
 * test/eval script -> MiniHarnessService.runTask -> injected agentRunner -> evaluate checks
 *
 * 它不会直接调用真实模型。调用方注入 agentRunner，让单元测试可以稳定运行，
 * 后续章节也可以把真实 AgentLoop 包装成 runner 接进来。
 */
export class MiniHarnessService {
  constructor(
    private runner: MiniHarnessAgentRunner,
    private options: MiniHarnessOptions = {}
  ) {}

  /**
   * 复制 fixture 仓库，运行一次 agent 任务，并检查结果是否符合预期。
   */
  async runTask(task: MiniHarnessTask): Promise<MiniHarnessTaskResult> {
    // 1. 每个任务都在独立 workspace 里运行，避免污染教程项目本身。
    const workspaceDir = await this.prepareWorkspace(task);

    try {
      // 2. runner 是外部注入的。Mini Harness 只关心输入、输出和检查结果。
      const agentRun = await this.runner({
        task,
        workspaceDir,
      });
      const checks = this.evaluate(task, agentRun);
      const success = checks.every((check) => check.success);

      await this.cleanupWorkspace(workspaceDir);

      return {
        taskId: task.id,
        title: task.title,
        success,
        workspaceDir,
        checks,
        agentRun,
      };
    } catch (error) {
      await this.cleanupWorkspace(workspaceDir);

      return {
        taskId: task.id,
        title: task.title,
        success: false,
        workspaceDir,
        checks: [
          {
            name: 'runner completed',
            success: false,
            expected: 'runner resolves without throwing',
            actual: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 批量运行任务，并保留每个任务的独立结果。
   */
  async runTasks(tasks: MiniHarnessTask[]): Promise<MiniHarnessTaskResult[]> {
    const results: MiniHarnessTaskResult[] = [];
    for (const task of tasks) {
      results.push(await this.runTask(task));
    }

    return results;
  }

  private async prepareWorkspace(task: MiniHarnessTask): Promise<string> {
    const root =
      this.options.workspaceRoot ??
      (await fs.mkdtemp(path.join(os.tmpdir(), 'codemate-mini-harness-')));
    await fs.mkdir(root, { recursive: true });

    const workspaceDir = path.join(root, this.sanitizeTaskId(task.id));
    await fs.rm(workspaceDir, { recursive: true, force: true });
    await fs.cp(task.fixtureDir, workspaceDir, { recursive: true });
    return workspaceDir;
  }

  private async cleanupWorkspace(workspaceDir: string): Promise<void> {
    if (this.options.keepWorkspaces ?? true) {
      return;
    }

    await fs.rm(workspaceDir, { recursive: true, force: true });
  }

  private evaluate(task: MiniHarnessTask, agentRun: MiniHarnessAgentRun): MiniHarnessCheck[] {
    const checks: MiniHarnessCheck[] = [
      this.createCheck(
        'agent success',
        agentRun.success === (task.expected.agentSuccess ?? true),
        String(task.expected.agentSuccess ?? true),
        String(agentRun.success)
      ),
    ];

    checks.push(
      ...this.evaluateIncludedText(
        'model input includes',
        task.expected.modelInputIncludes,
        agentRun.modelInput
      )
    );
    checks.push(
      ...this.evaluateIncludedText(
        'response includes',
        task.expected.responseIncludes,
        agentRun.responseContent
      )
    );
    checks.push(...this.evaluateChangedFiles(task.expected.changedFiles, agentRun.changedFiles));

    if (task.expected.verificationSuccess !== undefined) {
      checks.push(
        this.createCheck(
          'verification success',
          agentRun.verification?.success === task.expected.verificationSuccess,
          String(task.expected.verificationSuccess),
          String(agentRun.verification?.success ?? 'missing')
        )
      );
    }

    return checks;
  }

  private evaluateIncludedText(
    name: string,
    expectedItems: string[] | undefined,
    actualText: string | undefined
  ): MiniHarnessCheck[] {
    return (expectedItems ?? []).map((expected) =>
      this.createCheck(
        `${name}: ${expected}`,
        actualText?.includes(expected) ?? false,
        expected,
        actualText ? 'present text' : 'missing text'
      )
    );
  }

  private evaluateChangedFiles(
    expectedFiles: string[] | undefined,
    actualFiles: string[] | undefined
  ): MiniHarnessCheck[] {
    const normalizedActual = new Set((actualFiles ?? []).map((file) => this.normalizePath(file)));

    return (expectedFiles ?? []).map((expected) => {
      const normalizedExpected = this.normalizePath(expected);
      return this.createCheck(
        `changed file: ${normalizedExpected}`,
        normalizedActual.has(normalizedExpected),
        normalizedExpected,
        Array.from(normalizedActual).sort().join(', ') || 'none'
      );
    });
  }

  private createCheck(
    name: string,
    success: boolean,
    expected: string,
    actual: string
  ): MiniHarnessCheck {
    return {
      name,
      success,
      expected,
      actual,
    };
  }

  private sanitizeTaskId(taskId: string): string {
    return taskId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}
