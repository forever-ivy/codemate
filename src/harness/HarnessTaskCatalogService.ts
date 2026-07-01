import * as fs from 'node:fs/promises';
import * as path from 'pathe';
import { z } from 'zod';
import type { MiniHarnessTask } from './MiniHarnessService';

const expectationSchema = z.object({
  agentSuccess: z.boolean().optional(),
  modelInputIncludes: z.array(z.string().min(1)).optional(),
  changedFiles: z.array(z.string().min(1)).optional(),
  verificationSuccess: z.boolean().optional(),
  responseIncludes: z.array(z.string().min(1)).optional(),
});

const taskSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  category: z.enum(['bugfix', 'feature', 'refactor', 'test']),
  tags: z.array(z.string().min(1)).default([]),
  fixture: z.string().min(1),
  userMessage: z.string().min(1),
  verificationCommands: z.array(z.string().min(1)).min(1),
  expected: expectationSchema,
});

const catalogSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskSchema).min(1),
});

export type HarnessTaskCategory = z.infer<typeof taskSchema>['category'];

export interface HarnessTaskDefinition extends MiniHarnessTask {
  category: HarnessTaskCategory;
  tags: string[];
  fixture: string;
  verificationCommands: string[];
}

export interface HarnessTaskCatalog {
  version: 1;
  sourcePath: string;
  tasks: HarnessTaskDefinition[];
}

/**
 * HarnessTaskCatalogService loads versioned task manifests and resolves their
 * fixture repositories without allowing paths to escape the catalog directory.
 */
export class HarnessTaskCatalogService {
  async load(catalogPath: string): Promise<HarnessTaskCatalog> {
    const absoluteCatalogPath = path.resolve(catalogPath);
    const catalogDir = path.dirname(absoluteCatalogPath);
    const rawCatalog = await this.readCatalog(absoluteCatalogPath);
    const parsed = catalogSchema.safeParse(rawCatalog);

    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'catalog'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid harness task catalog: ${details}`);
    }

    const taskIds = new Set<string>();
    const tasks: HarnessTaskDefinition[] = [];

    for (const task of parsed.data.tasks) {
      if (taskIds.has(task.id)) {
        throw new Error(`Duplicate harness task id: ${task.id}`);
      }
      taskIds.add(task.id);

      const fixtureDir = this.resolveFixtureDir(catalogDir, task.fixture);
      await this.assertFixtureRepository(task.id, fixtureDir);
      tasks.push({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        tags: task.tags,
        fixture: task.fixture,
        fixtureDir,
        userMessage: task.userMessage,
        verificationCommands: task.verificationCommands,
        expected: task.expected,
      });
    }

    return {
      version: 1,
      sourcePath: absoluteCatalogPath,
      tasks,
    };
  }

  private async readCatalog(catalogPath: string): Promise<unknown> {
    const content = await fs.readFile(catalogPath, 'utf-8');
    try {
      return JSON.parse(content) as unknown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid harness task catalog JSON: ${message}`);
    }
  }

  private resolveFixtureDir(catalogDir: string, fixture: string): string {
    const fixtureDir = path.resolve(catalogDir, fixture);
    const relativePath = path.relative(catalogDir, fixtureDir);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`Fixture path must stay inside the catalog directory: ${fixture}`);
    }
    return fixtureDir;
  }

  private async assertFixtureRepository(taskId: string, fixtureDir: string): Promise<void> {
    const stats = await fs.stat(fixtureDir).catch(() => undefined);
    if (!stats?.isDirectory()) {
      throw new Error(`Fixture repository not found for task ${taskId}: ${fixtureDir}`);
    }

    const packagePath = path.join(fixtureDir, 'package.json');
    const packageStats = await fs.stat(packagePath).catch(() => undefined);
    if (!packageStats?.isFile()) {
      throw new Error(`Fixture repository for task ${taskId} must contain package.json`);
    }
  }
}
