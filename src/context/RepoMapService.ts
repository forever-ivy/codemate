import * as fs from 'node:fs';
import * as path from 'pathe';
import type { VerificationIssue } from '../verification/VerificationErrorParser';
import { type CodeGraph, CodeGraphService } from './CodeGraphService';
import { GitDiffService, type GitDiffSnapshot } from './GitDiffService';
import { type SemanticIndex, SemanticIndexService } from './SemanticIndexService';

export interface RepoMapFile {
  // 始终保存仓库相对路径，方便工具和 prompt 复用同一套路径。
  // 这里不要暴露用户机器上的绝对路径。
  path: string;
  ext: string;
  size: number;
  // score 只出现在被选择的文件上，原始 RepoMap 文件列表不做排序污染。
  score?: number;
}

export interface RepoMapDirectory {
  // 顶层目录名，例如 src、tests；根目录文件统一归到 "."。
  path: string;
  fileCount: number;
  totalSize: number;
}

export type RepoMapSkippedReason =
  | 'ignored-dir'
  | 'hidden-path'
  | 'max-depth'
  | 'read-error'
  | 'stat-error';

export interface RepoMapSkippedPath {
  path: string;
  // 记录跳过原因，让上下文选择可解释，而不是静默隐藏 node_modules 或 .git。
  reason: RepoMapSkippedReason;
}

export interface RepoIndex {
  // 当前 index 和 RepoMap 同时生成；单独保留时间戳，方便后续拆成独立缓存。
  generatedAt: number;
  fileCount: number;
  totalSize: number;
  // 扩展名和目录摘要能让模型低成本判断项目形态，不需要塞完整目录树。
  byExtension: Record<string, number>;
  directories: RepoMapDirectory[];
  skipped: RepoMapSkippedPath[];
}

export interface RepoMap {
  cwd: string;
  generatedAt: number;
  packageManager?: string;
  projectType: string[];
  importantFiles: string[];
  sourceRoots: string[];
  files: RepoMapFile[];
  index: RepoIndex;
  gitDiff: GitDiffSnapshot;
  codeGraph: CodeGraph;
  semanticIndex: SemanticIndex;
}

export interface SelectedContext {
  repoMap: RepoMap;
  selectedFiles: RepoMapFile[];
  prompt: string;
}

export interface RepoMapOptions {
  // 硬限制用于防止大仓库把上下文选择拖成一次很慢的全量扫描。
  maxFiles?: number;
  maxSelectedFiles?: number;
  maxDepth?: number;
  // 短缓存用于减少一次交互内的重复扫描，同时让文件改动尽快可见。
  cacheTtlMs?: number;
  // 结构图只分析前 N 个源码文件，避免大仓库在 RepoMap 阶段变慢。
  maxGraphFiles?: number;
}

/**
 * RepoMapService 负责在模型调用前建立仓库地图，并按用户请求选择候选文件。
 *
 * 本章的索引只基于路径和文件元信息，不读取文件内容。
 * 后续 Context Builder、Token Budget、AST / Import Graph 都会建立在这个快照之上。
 */
export class RepoMapService {
  private cachedRepoMap?: RepoMap;

  private ignoredDirs = new Set([
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.next',
    '.turbo',
    '.cache',
  ]);

  private importantNames = new Set([
    'package.json',
    'tsconfig.json',
    'vite.config.ts',
    'vitest.config.ts',
    'README.md',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
  ]);

  constructor(
    private cwd: string,
    private options: RepoMapOptions = {},
    private gitDiffService: Pick<GitDiffService, 'getSnapshot'> = new GitDiffService(cwd),
    private codeGraphService: Pick<CodeGraphService, 'build'> = new CodeGraphService(cwd, {
      maxFiles: options.maxGraphFiles,
    }),
    private semanticIndexService: Pick<
      SemanticIndexService,
      'build' | 'query'
    > = new SemanticIndexService()
  ) {}

  /**
   * 构建或复用 AgentLoop 模型调用前使用的仓库地图。
   *
   * 这个方法只扫描路径和文件元信息，不读取文件内容。
   * 文件内容读取会在后续 Context Builder 章节完成。
   */
  build(): RepoMap {
    // 1. 如果短时间内已经扫描过仓库，直接复用快照。
    //    这样一次 CLI 交互里多次选择上下文时，不会反复扫大仓库。
    const cached = this.getCachedRepoMap();
    if (cached) {
      return cached;
    }

    // 2. 扫描仓库，同时收集“可见文件”和“被跳过的路径”。
    //    skipped 让隐藏目录、依赖目录的跳过行为可解释。
    const skipped: RepoMapSkippedPath[] = [];
    const files = this.walk(this.cwd, this.cwd, 0, skipped).slice(0, this.options.maxFiles ?? 500);

    // 3. 提取高信号文件。模型先看到 package/tsconfig/readme 这类路径，
    //    就能判断项目形态，但暂时不需要读取它们的内容。
    const importantFiles = files
      .filter((file) => this.importantNames.has(path.basename(file.path)))
      .map((file) => file.path);

    // 4. 读取当前 Git 工作区变更。这里仍然只读取路径级信息，
    //    不把完整 diff 塞进上下文。
    const gitDiff = this.gitDiffService.getSnapshot();

    // 5. 基于源码文件构建轻量结构图。这里会读取少量源码文本，
    //    只抽取 import/export/声明符号，不做类型检查或完整编译。
    const codeGraph = this.codeGraphService.build(files);
    const semanticIndex = this.semanticIndexService.build(files, codeGraph);

    // 6. 组装最终 RepoMap。index 来自同一次扫描，
    //    因此文件列表、目录统计、跳过路径描述的是同一个仓库快照。
    const repoMap = {
      cwd: this.cwd,
      generatedAt: Date.now(),
      packageManager: this.detectPackageManager(files),
      projectType: this.detectProjectType(files),
      importantFiles,
      sourceRoots: this.detectSourceRoots(files),
      files,
      index: this.buildIndex(files, skipped),
      gitDiff,
      codeGraph,
      semanticIndex,
    };

    this.cachedRepoMap = repoMap;
    return repoMap;
  }

  /**
   * 强制刷新仓库地图，并返回新的扫描结果。
   *
   * 后续文件工具创建、删除文件后，可以调用它让下一次上下文选择看到新文件。
   */
  refresh(): RepoMap {
    this.invalidate();
    return this.build();
  }

  /**
   * 清空缓存，但不立刻重新扫描。
   */
  invalidate(): void {
    this.cachedRepoMap = undefined;
  }

  /**
   * 根据用户请求选择一小段仓库上下文。
   *
   * AgentLoop 会把返回的 prompt 拼进模型输入。
   * session 历史里仍然保存用户的原始输入，不保存这段系统上下文。
   */
  selectForMessage(message: string): SelectedContext {
    // 1. 先构建或复用路径级仓库快照。
    const repoMap = this.build();

    // 2. 把用户请求拆成关键词，方便用 agent/test/config 等词匹配文件路径。
    const queryTokens = this.tokenize(message);
    const changedPathSet = new Set(repoMap.gitDiff.changedFiles.map((file) => file.path));

    // 3. 基于路径给文件打分，并限制数量。
    //    这是第一版启发式选择器，后续会加入文件内容、AST、import graph 等信号。
    const selectedFiles = repoMap.files
      .map((file) => ({
        ...file,
        score: this.scoreFile(
          file,
          queryTokens,
          changedPathSet,
          repoMap.codeGraph,
          repoMap.semanticIndex
        ),
      }))
      .filter((file) => (file.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, this.options.maxSelectedFiles ?? 8);

    return {
      repoMap,
      selectedFiles,
      prompt: this.formatForPrompt(repoMap, selectedFiles),
    };
  }

  /**
   * 根据验证失败问题选择修复上下文。
   *
   * 这条路径服务于 AgentLoop 的 repair 阶段。
   * 和普通用户消息不同，验证错误通常已经带有 file/line/source，
   * 所以这里会把错误文件作为强信号，而不是只依赖自然语言关键词。
   */
  selectForVerificationIssues(message: string, issues: VerificationIssue[]): SelectedContext {
    // 1. 复用同一套 RepoMap 快照。验证失败后通常刚做完文件修改，
    //    调用方如果需要最新文件列表，可以先 invalidate/refresh。
    const repoMap = this.build();

    // 2. 把用户请求、错误文件、错误消息和命令来源合成查询词。
    //    这样即使错误没有精确文件，也仍能用 test/typecheck/build 等词匹配。
    const issueFiles = issues
      .map((issue) => issue.file)
      .filter((file): file is string => Boolean(file));
    const queryTokens = this.tokenize(
      [
        message,
        ...issueFiles,
        ...issues.map((issue) => issue.message),
        ...issues.map((issue) => issue.source),
      ].join(' ')
    );
    const issueFileSet = new Set(issueFiles.map((file) => this.normalizeRepoPath(file)));
    const relatedPathSet = this.deriveRelatedIssuePaths(issueFileSet);
    const changedPathSet = new Set(repoMap.gitDiff.changedFiles.map((file) => file.path));

    // 3. 叠加三类分数：普通请求相关性、Git 改动、验证错误命中。
    //    验证错误命中权重最高，因为它来自真实失败输出。
    const selectedFiles = repoMap.files
      .map((file) => ({
        ...file,
        score:
          this.scoreFile(file, queryTokens, changedPathSet, repoMap.codeGraph) +
          this.scoreVerificationFile(file, issueFileSet, relatedPathSet) +
          this.scoreGraphFile(file, issueFileSet, repoMap.codeGraph) +
          this.scoreSemanticFile(file, queryTokens, repoMap.semanticIndex),
      }))
      .filter((file) => (file.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, this.options.maxSelectedFiles ?? 8);

    return {
      repoMap,
      selectedFiles,
      prompt: this.formatForPrompt(repoMap, selectedFiles, issueFiles),
    };
  }

  /**
   * 只在 TTL 窗口内返回缓存的仓库地图。
   */
  private getCachedRepoMap(): RepoMap | undefined {
    // 1. 没有上一次扫描结果，就没有可复用的缓存。
    if (!this.cachedRepoMap) {
      return undefined;
    }

    // 2. cacheTtlMs <= 0 表示显式关闭缓存，测试和敏感刷新场景会用到。
    const cacheTtlMs = this.options.cacheTtlMs ?? 2_000;
    if (cacheTtlMs <= 0) {
      return undefined;
    }

    // 3. 只复用仍在 TTL 内的快照；过期快照交给 build() 重新生成。
    return Date.now() - this.cachedRepoMap.generatedAt <= cacheTtlMs
      ? this.cachedRepoMap
      : undefined;
  }

  /**
   * 递归扫描目录下的普通文件。
   *
   * 返回值只包含普通文件。
   * 被忽略、读不到、超过深度的路径会写入 skipped，避免一个目录失败导致整次 agent run 失败。
   */
  private walk(
    dir: string,
    root: string,
    depth: number,
    skipped: RepoMapSkippedPath[]
  ): RepoMapFile[] {
    // 1. 先检查递归深度。超过 maxDepth 不是错误，
    //    而是大仓库保护策略，所以记录后直接跳过。
    const relativeDir = path.relative(root, dir) || '.';
    if (depth > (this.options.maxDepth ?? 6)) {
      skipped.push({ path: relativeDir, reason: 'max-depth' });
      return [];
    }

    // 2. 防御式读取目录。CLI 运行时文件可能被移动，目录权限也可能不同。
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      skipped.push({ path: relativeDir, reason: 'read-error' });
      return [];
    }

    const files: RepoMapFile[] = [];

    // 3. 遍历目录项。先判断目录是否该跳过，
    //    这样 node_modules 这类目录不会展开成几千个文件。
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.name.startsWith('.') && entry.name !== '.aicli') {
        skipped.push({ path: relativePath, reason: 'hidden-path' });
        continue;
      }
      if (entry.isDirectory() && this.ignoredDirs.has(entry.name)) {
        skipped.push({ path: relativePath, reason: 'ignored-dir' });
        continue;
      }

      // 4. 对允许进入的目录继续递归，并把子目录文件合并到当前结果。
      if (entry.isDirectory()) {
        files.push(...this.walk(absolutePath, root, depth + 1, skipped));
        continue;
      }

      // 5. 本章只处理普通文件。符号链接、socket 等特殊条目先忽略，
      //    后续文件系统章节再决定是否支持。
      if (!entry.isFile()) {
        continue;
      }

      // 6. 把文件元信息转换成轻量 RepoMapFile。
      //    如果文件在 readdir 和 stat 之间消失，只记录 stat-error 并继续扫描。
      try {
        const stats = fs.statSync(absolutePath);
        files.push({
          path: relativePath,
          ext: path.extname(entry.name).toLowerCase(),
          size: stats.size,
        });
      } catch {
        skipped.push({ path: relativePath, reason: 'stat-error' });
      }
    }

    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * 把原始扫描结果转换成紧凑的仓库索引。
   */
  private buildIndex(files: RepoMapFile[], skipped: RepoMapSkippedPath[]): RepoIndex {
    // 1. 索引摘要必须便宜。它发生在模型决定读哪些文件之前，
    //    所以这里绝不能读取文件内容。
    return {
      generatedAt: Date.now(),
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      byExtension: this.countByExtension(files),
      directories: this.summarizeTopLevelDirectories(files),
      skipped: skipped.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }

  /**
   * 按扩展名统计文件数量，帮助模型判断主要项目语言。
   */
  private countByExtension(files: RepoMapFile[]): Record<string, number> {
    const counts: Record<string, number> = {};

    // 1. 没有扩展名的文件统一归到 [none]，不要直接丢掉。
    for (const file of files) {
      const key = file.ext || '[none]';
      counts[key] = (counts[key] ?? 0) + 1;
    }

    // 2. 按扩展名排序，保证 prompt 和测试结果稳定。
    return Object.fromEntries(
      Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
    );
  }

  /**
   * 统计顶层目录，不展开完整目录树。
   */
  private summarizeTopLevelDirectories(files: RepoMapFile[]): RepoMapDirectory[] {
    const directories = new Map<string, RepoMapDirectory>();

    // 1. 把路径折叠到第一段。这样 prompt 能看到项目形态，
    //    又不会被完整目录树撑大。
    for (const file of files) {
      const firstPart = file.path.includes('/') ? file.path.split('/')[0] : '.';
      const current = directories.get(firstPart) ?? {
        path: firstPart,
        fileCount: 0,
        totalSize: 0,
      };

      current.fileCount += 1;
      current.totalSize += file.size;
      directories.set(firstPart, current);
    }

    // 2. 文件数量多的目录排在前面，让 prompt 优先展示更可能重要的源码目录。
    return Array.from(directories.values()).sort(
      (a, b) => b.fileCount - a.fileCount || a.path.localeCompare(b.path)
    );
  }

  /**
   * 根据 lockfile 推断包管理器。
   */
  private detectPackageManager(files: RepoMapFile[]): string | undefined {
    if (files.some((file) => file.path === 'pnpm-lock.yaml')) return 'pnpm';
    if (files.some((file) => file.path === 'yarn.lock')) return 'yarn';
    if (files.some((file) => file.path === 'package-lock.json')) return 'npm';
    return files.some((file) => file.path === 'package.json') ? 'npm' : undefined;
  }

  /**
   * 根据配置文件和扩展名推断项目类型。
   */
  private detectProjectType(files: RepoMapFile[]): string[] {
    const types = new Set<string>();
    if (files.some((file) => file.path === 'package.json')) types.add('node');
    if (files.some((file) => file.path === 'tsconfig.json')) types.add('typescript');
    if (files.some((file) => file.ext === '.tsx')) types.add('react');
    if (files.some((file) => file.ext === '.py')) types.add('python');
    if (files.some((file) => file.path === 'Cargo.toml')) types.add('rust');
    if (files.some((file) => file.path === 'go.mod')) types.add('go');
    return Array.from(types);
  }

  /**
   * 识别常见源码根目录，让模型优先关注这些区域。
   */
  private detectSourceRoots(files: RepoMapFile[]): string[] {
    const roots = new Set<string>();
    for (const file of files) {
      const firstPart = file.path.split('/')[0];
      if (['src', 'test', 'tests', 'app', 'lib', 'packages', 'web'].includes(firstPart)) {
        roots.add(firstPart);
      }
    }
    return Array.from(roots).sort();
  }

  /**
   * 根据用户请求关键词给单个文件打相关性分数。
   */
  private scoreFile(
    file: RepoMapFile,
    queryTokens: string[],
    changedPathSet = new Set<string>(),
    codeGraph?: CodeGraph,
    semanticIndex?: SemanticIndex
  ): number {
    const fileTokens = this.tokenize(file.path);
    let score = 0;

    // 1. 路径直接命中是当前简单选择器里最强的信号。
    for (const token of queryTokens) {
      if (file.path.toLowerCase().includes(token)) score += 4;
      if (fileTokens.includes(token)) score += 3;
    }

    // 2. 对 coding agent 常见词加一点领域提示。
    //    权重保持较小，避免压过精确路径命中。
    if (this.importantNames.has(path.basename(file.path))) score += 1;
    if (queryTokens.includes('test') && file.path.includes('test')) score += 3;
    if (queryTokens.includes('ui') && ['.tsx', '.jsx', '.css'].includes(file.ext)) score += 2;
    if (queryTokens.includes('config') && file.path.includes('config')) score += 2;
    if (queryTokens.includes('agent') && file.path.includes('agent')) score += 2;
    if (queryTokens.includes('tool') && file.path.includes('tool')) score += 2;

    // 3. 本地已修改文件是非常强的上下文信号。
    //    用户经常会问“帮我看下刚才改的问题”，这类请求不一定包含文件名。
    if (changedPathSet.has(file.path)) score += 10;

    // 4. 结构图里的符号名和导入源也能参与匹配。
    //    例如用户说 ContextBudgetService，即使文件路径没完全命中，导出的 class 也能加分。
    const graphFile = codeGraph?.files.find((item) => item.path === file.path);
    if (graphFile) {
      const graphTokens = this.tokenize(
        [
          ...graphFile.symbols.map((symbol) => symbol.name),
          ...graphFile.exports,
          ...graphFile.imports.map((item) => item.source),
        ].join(' ')
      );
      for (const token of queryTokens) {
        if (graphTokens.includes(token)) score += 4;
      }
    }

    score += this.scoreSemanticFile(file, queryTokens, semanticIndex);

    return score;
  }

  private scoreVerificationFile(
    file: RepoMapFile,
    issueFileSet: Set<string>,
    relatedPathSet: Set<string>
  ): number {
    // 1. 精确命中验证错误文件是最强信号。
    if (issueFileSet.has(file.path)) {
      return 30;
    }

    // 2. 测试文件和源码文件经常同名不同目录。
    //    例如 tests/Foo.test.ts 失败时，src/Foo.ts 也很可能相关。
    if (relatedPathSet.has(file.path)) {
      return 12;
    }

    // 3. 如果路径不同但 basename 相同，也给一点分。
    //    这覆盖 packages/foo/src/Button.tsx 和 tests/Button.test.tsx 这类结构。
    const fileBaseName = this.stripTestSuffix(path.basename(file.path, file.ext));
    for (const issueFile of issueFileSet) {
      const issueBaseName = this.stripTestSuffix(path.basename(issueFile, path.extname(issueFile)));
      if (fileBaseName && fileBaseName === issueBaseName) {
        return 6;
      }
    }

    return 0;
  }

  private scoreGraphFile(
    file: RepoMapFile,
    issueFileSet: Set<string>,
    codeGraph: CodeGraph
  ): number {
    // 1. repair 阶段如果某个文件依赖错误文件，或者被错误文件依赖，
    //    它也可能是修复所需上下文。
    for (const edge of codeGraph.edges) {
      if (issueFileSet.has(edge.from) && edge.to === file.path) {
        return 8;
      }
      if (issueFileSet.has(edge.to) && edge.from === file.path) {
        return 5;
      }
    }

    return 0;
  }

  private scoreSemanticFile(
    file: RepoMapFile,
    queryTokens: string[],
    semanticIndex?: SemanticIndex
  ): number {
    if (!semanticIndex) {
      return 0;
    }

    const semanticQuery = this.semanticIndexService.query(semanticIndex, queryTokens.join(' '));
    let score = 0;

    if (semanticQuery.matchedSymbols.some((symbol) => symbol.path === file.path)) {
      score += 10;
    }
    if (semanticQuery.relatedFiles.includes(file.path)) {
      score += 6;
    }
    if (semanticQuery.diagnostics.some((diagnostic) => diagnostic.path === file.path)) {
      score += 4;
    }

    return score;
  }

  /**
   * 把用户文本和路径拆成可比较的小写关键词。
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 2);
  }

  /**
   * 把仓库地图格式化成 AgentLoop 注入模型的紧凑 prompt 前缀。
   */
  private formatForPrompt(
    repoMap: RepoMap,
    selectedFiles: RepoMapFile[],
    verificationFiles: string[] = []
  ): string {
    // 1. prompt 只放事实摘要。模型先了解仓库形态，
    //    之后可以通过工具读取真正需要的文件。
    const lines = [
      '## Repository Context',
      '',
      `Project types: ${repoMap.projectType.length > 0 ? repoMap.projectType.join(', ') : 'unknown'}`,
      `Package manager: ${repoMap.packageManager ?? 'unknown'}`,
      `Source roots: ${repoMap.sourceRoots.length > 0 ? repoMap.sourceRoots.join(', ') : 'none detected'}`,
      '',
      'Repository index:',
      `- Files indexed: ${repoMap.index.fileCount}`,
      `- Total size: ${repoMap.index.totalSize} bytes`,
      `- Top extensions: ${this.formatExtensionSummary(repoMap.index.byExtension)}`,
      `- Top directories: ${this.formatDirectorySummary(repoMap.index.directories)}`,
      `- Skipped paths: ${this.formatSkippedSummary(repoMap.index.skipped)}`,
      '',
      'Git changes:',
      ...this.formatGitChanges(repoMap.gitDiff),
      '',
      'Code graph:',
      ...this.formatCodeGraph(repoMap.codeGraph, selectedFiles),
      '',
      'Semantic index:',
      ...this.formatSemanticIndex(repoMap.semanticIndex, selectedFiles),
      '',
      'Verification files:',
      ...this.formatList(verificationFiles, 8),
      '',
      'Important files:',
      ...this.formatList(repoMap.importantFiles, 10),
      '',
      'Likely relevant files:',
      ...this.formatList(
        selectedFiles.map((file) => file.path),
        12
      ),
    ];

    return lines.join('\n');
  }

  private formatExtensionSummary(byExtension: Record<string, number>): string {
    const entries = Object.entries(byExtension)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 5);

    if (entries.length === 0) {
      return 'none';
    }

    return entries.map(([ext, count]) => `${ext}: ${count}`).join(', ');
  }

  private formatDirectorySummary(directories: RepoMapDirectory[]): string {
    if (directories.length === 0) {
      return 'none';
    }

    return directories
      .slice(0, 5)
      .map((directory) => `${directory.path} (${directory.fileCount} files)`)
      .join(', ');
  }

  private formatSkippedSummary(skipped: RepoMapSkippedPath[]): string {
    if (skipped.length === 0) {
      return 'none';
    }

    return skipped
      .slice(0, 5)
      .map((item) => `${item.path} (${item.reason})`)
      .join(', ');
  }

  private formatGitChanges(gitDiff: GitDiffSnapshot): string[] {
    if (!gitDiff.isGitRepository) {
      return [`- not a git repository${gitDiff.error ? ` (${gitDiff.error})` : ''}`];
    }

    if (gitDiff.changedFiles.length === 0) {
      return ['- none'];
    }

    return gitDiff.changedFiles.slice(0, 12).map((file) => `- ${file.path} (${file.status})`);
  }

  private formatCodeGraph(codeGraph: CodeGraph, selectedFiles: RepoMapFile[]): string[] {
    if (codeGraph.fileCount === 0) {
      return ['- none'];
    }

    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const relevantGraphFiles = codeGraph.files.filter((file) => selectedPathSet.has(file.path));
    const graphFiles =
      relevantGraphFiles.length > 0 ? relevantGraphFiles : codeGraph.files.slice(0, 5);
    const lines = [
      `- Files analyzed: ${codeGraph.fileCount}`,
      `- Internal edges: ${codeGraph.edges.length}`,
    ];

    if (codeGraph.parseErrors.length > 0) {
      lines.push(`- Parse errors: ${codeGraph.parseErrors.length}`);
    }

    for (const file of graphFiles.slice(0, 6)) {
      const symbols = file.symbols
        .slice(0, 4)
        .map((symbol) => `${symbol.exported ? 'export ' : ''}${symbol.kind} ${symbol.name}`)
        .join(', ');
      const dependencies =
        file.internalDependencies.length > 0
          ? ` -> ${file.internalDependencies.slice(0, 4).join(', ')}`
          : '';
      lines.push(`- ${file.path}: ${symbols || 'no symbols'}${dependencies}`);
    }

    return lines;
  }

  private formatSemanticIndex(
    semanticIndex: SemanticIndex,
    selectedFiles: RepoMapFile[]
  ): string[] {
    if (semanticIndex.fileCount === 0) {
      return ['- none'];
    }

    const selectedPathSet = new Set(selectedFiles.map((file) => file.path));
    const relevantSymbols = semanticIndex.symbols.filter((symbol) =>
      selectedPathSet.has(symbol.path)
    );
    const symbolPreview =
      relevantSymbols.length > 0 ? relevantSymbols : semanticIndex.symbols.slice(0, 6);
    const referencePreview = semanticIndex.references.filter(
      (reference) => selectedPathSet.has(reference.from) || selectedPathSet.has(reference.to)
    );

    const lines = [
      `- Files indexed: ${semanticIndex.fileCount}`,
      `- Symbols indexed: ${semanticIndex.symbols.length}`,
      `- References indexed: ${semanticIndex.references.length}`,
      `- Diagnostics: ${semanticIndex.diagnostics.length}`,
    ];

    for (const symbol of symbolPreview.slice(0, 6)) {
      lines.push(
        `- ${symbol.path}: ${symbol.exported ? 'export ' : ''}${symbol.kind} ${symbol.name}`
      );
    }

    for (const reference of referencePreview.slice(0, 4)) {
      lines.push(`- reference: ${reference.from} -> ${reference.to}`);
    }

    return lines;
  }

  private formatList(items: string[], limit: number): string[] {
    if (items.length === 0) {
      return ['- none'];
    }

    return items.slice(0, limit).map((item) => `- ${item}`);
  }

  private deriveRelatedIssuePaths(issueFileSet: Set<string>): Set<string> {
    const related = new Set<string>();

    for (const issueFile of issueFileSet) {
      const normalized = this.normalizeRepoPath(issueFile);
      const ext = path.extname(normalized);
      const directory = path.dirname(normalized);
      const baseName = this.stripTestSuffix(path.basename(normalized, ext));

      if (!baseName) {
        continue;
      }

      // 1. 测试文件失败时，优先猜测同名源码文件。
      if (normalized.includes('test')) {
        for (const sourceRoot of ['src', 'app', 'lib']) {
          related.add(`${sourceRoot}/${baseName}${ext}`);
          related.add(`${sourceRoot}/${baseName}.tsx`);
          related.add(`${sourceRoot}/${baseName}.ts`);
        }
      }

      // 2. 源码文件失败时，补充常见测试文件路径。
      related.add(`${directory}/${baseName}.test${ext}`);
      related.add(`tests/${baseName}.test${ext}`);
      related.add(`tests/unit/${baseName}.test${ext}`);
    }

    return related;
  }

  private stripTestSuffix(name: string): string {
    return name.replace(/\.(test|spec)$/i, '');
  }

  private normalizeRepoPath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  }
}
