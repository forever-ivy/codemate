import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'pathe';
import type {
  AnalysisResult,
  CodeIssue,
  CodeMetrics,
  AnalysisSummary,
  IssueSeverity,
  IssueCategory,
} from './types.js';
import type { ReviewRule, RuleContext } from './rules.js';
import { BUILTIN_RULES } from './rules.js';

/**
 * 代码分析器
 *
 * 负责分析代码文件，检测问题和计算指标
 */
export class CodeAnalyzer {
  private rules: ReviewRule[] = [...BUILTIN_RULES];

  /**
   * 分析单个文件
   */
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const language = this.detectLanguage(filePath);

      const issues = await this.findIssues(content, filePath, language);
      const metrics = this.calculateMetrics(content, language);
      const summary = this.generateSummary(issues, metrics);

      return {
        file: filePath,
        issues,
        metrics,
        summary,
      };
    } catch (error) {
      console.error(`分析文件失败: ${filePath}`, error);
      return {
        file: filePath,
        issues: [],
        metrics: this.getDefaultMetrics(),
        summary: this.getDefaultSummary(),
      };
    }
  }

  /**
   * 分析目录
   */
  async analyzeDirectory(
    dirPath: string,
    options?: {
      includePatterns?: string[];
      excludePatterns?: string[];
      recursive?: boolean;
    }
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const files = await this.getFilesToAnalyze(dirPath, options);

    for (const file of files) {
      const result = await this.analyzeFile(file);
      results.push(result);
    }

    return results;
  }

  /**
   * 分析Git差异
   */
  async analyzeDiff(diff: string): Promise<AnalysisResult> {
    // 解析diff，提取修改的行
    const changes = this.parseDiff(diff);
    const issues: CodeIssue[] = [];

    for (const change of changes) {
      const fileIssues = await this.findIssues(
        change.content,
        change.file,
        this.detectLanguage(change.file)
      );

      // 只保留修改行的问题
      const relevantIssues = fileIssues.filter((issue) => change.lines.includes(issue.line || 0));

      issues.push(...relevantIssues);
    }

    const metrics = this.calculateDiffMetrics(changes);
    const summary = this.generateSummary(issues, metrics);

    return {
      file: 'diff',
      issues,
      metrics,
      summary,
    };
  }

  /**
   * 检测编程语言
   */
  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };

    return languageMap[ext] || 'text';
  }
  /**
   * 查找代码问题
   */
  private async findIssues(
    content: string,
    filePath: string,
    language: string
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    const context: RuleContext = {
      file: filePath,
      language,
      lines,
    };

    // 应用所有规则
    for (const rule of this.rules) {
      try {
        const violations = await rule.check(content, context);

        for (const violation of violations) {
          issues.push({
            id: `${rule.id}-${violation.line}-${violation.column || 0}`,
            severity: rule.severity,
            category: rule.category,
            title: rule.name,
            description: violation.message,
            file: filePath,
            line: violation.line,
            column: violation.column,
            code: lines[violation.line - 1]?.trim(),
            suggestion: violation.suggestion,
            autoFixable: violation.autoFixable,
            references: [],
          });
        }
      } catch (error) {
        console.error(`规则 ${rule.id} 执行失败:`, error);
      }
    }

    return issues;
  }

  /**
   * 计算代码指标
   */
  private calculateMetrics(content: string, language: string): CodeMetrics {
    const lines = content.split('\n');
    const codeLines = lines.filter(
      (line) => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('/*')
    );

    return {
      linesOfCode: codeLines.length,
      complexity: this.calculateComplexity(content, language),
      maintainabilityIndex: this.calculateMaintainabilityIndex(content),
    };
  }

  /**
   * 计算圈复杂度
   */
  private calculateComplexity(content: string, language: string): number {
    let complexity = 1; // 基础复杂度

    // 简单的复杂度计算（基于关键字）
    const complexityKeywords = [
      'if',
      'else',
      'elif',
      'while',
      'for',
      'switch',
      'case',
      'catch',
      'try',
      '&&',
      '||',
      '?',
      ':',
    ];

    for (const keyword of complexityKeywords) {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = /^\w+$/.test(keyword)
        ? new RegExp(`\\b${escapedKeyword}\\b`, 'g')
        : new RegExp(escapedKeyword, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * 计算可维护性指数
   */
  private calculateMaintainabilityIndex(content: string): number {
    const lines = content.split('\n');
    const codeLines = lines.filter((line) => line.trim()).length;
    const complexity = this.calculateComplexity(content, 'javascript');

    // 简化的可维护性指数计算
    // 基于代码行数和复杂度
    let index = 100;

    if (codeLines > 100) index -= 10;
    if (codeLines > 500) index -= 20;
    if (complexity > 10) index -= 15;
    if (complexity > 20) index -= 25;

    return Math.max(0, Math.min(100, index));
  }

  /**
   * 生成分析摘要
   */
  private generateSummary(issues: CodeIssue[], metrics: CodeMetrics): AnalysisSummary {
    const issuesBySeverity = issues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      },
      {} as Record<IssueSeverity, number>
    );

    const issuesByCategory = issues.reduce(
      (acc, issue) => {
        acc[issue.category] = (acc[issue.category] || 0) + 1;
        return acc;
      },
      {} as Record<IssueCategory, number>
    );

    // 计算分数（0-100）
    let score = 100;
    score -= (issuesBySeverity.critical || 0) * 20;
    score -= (issuesBySeverity.error || 0) * 10;
    score -= (issuesBySeverity.warning || 0) * 5;
    score -= (issuesBySeverity.info || 0) * 1;

    // 基于可维护性指数调整分数
    score = (score + metrics.maintainabilityIndex) / 2;

    score = Math.max(0, Math.min(100, score));

    // 计算等级
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return {
      totalIssues: issues.length,
      issuesBySeverity: {
        info: issuesBySeverity.info || 0,
        warning: issuesBySeverity.warning || 0,
        error: issuesBySeverity.error || 0,
        critical: issuesBySeverity.critical || 0,
      },
      issuesByCategory: {
        security: issuesByCategory.security || 0,
        performance: issuesByCategory.performance || 0,
        maintainability: issuesByCategory.maintainability || 0,
        reliability: issuesByCategory.reliability || 0,
        style: issuesByCategory.style || 0,
        'best-practice': issuesByCategory['best-practice'] || 0,
        bug: issuesByCategory.bug || 0,
        complexity: issuesByCategory.complexity || 0,
      },
      score,
      grade,
    };
  }

  /**
   * 获取要分析的文件列表
   */
  private async getFilesToAnalyze(
    dirPath: string,
    options?: {
      includePatterns?: string[];
      excludePatterns?: string[];
      recursive?: boolean;
    }
  ): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        if (options?.recursive !== false) {
          const subFiles = await this.getFilesToAnalyze(fullPath, options);
          files.push(...subFiles);
        }
      } else if (stats.isFile()) {
        if (this.shouldAnalyzeFile(fullPath, options)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * 判断是否应该分析文件
   */
  private shouldAnalyzeFile(
    filePath: string,
    options?: {
      includePatterns?: string[];
      excludePatterns?: string[];
    }
  ): boolean {
    const ext = extname(filePath);
    const supportedExtensions = [
      '.ts',
      '.js',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.cs',
      '.go',
      '.rs',
      '.php',
      '.rb',
    ];

    if (!supportedExtensions.includes(ext)) {
      return false;
    }

    // 检查排除模式
    if (options?.excludePatterns) {
      for (const pattern of options.excludePatterns) {
        if (filePath.includes(pattern)) {
          return false;
        }
      }
    }

    // 检查包含模式
    if (options?.includePatterns) {
      return options.includePatterns.some((pattern) => filePath.includes(pattern));
    }

    return true;
  }

  /**
   * 解析Git差异
   */
  private parseDiff(diff: string): Array<{
    file: string;
    content: string;
    lines: number[];
  }> {
    // 简化的diff解析
    const changes: Array<{
      file: string;
      content: string;
      lines: number[];
    }> = [];

    const lines = diff.split('\n');
    let currentFile = '';
    let currentContent = '';
    let currentLines: number[] = [];
    let lineNumber = 0;

    for (const line of lines) {
      if (line.startsWith('+++')) {
        currentFile = line.substring(4);
      } else if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (match) {
          lineNumber = parseInt(match[1]);
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        currentContent += line.substring(1) + '\n';
        currentLines.push(lineNumber);
        lineNumber++;
      } else if (!line.startsWith('-')) {
        lineNumber++;
      }
    }

    if (currentFile && currentContent) {
      changes.push({
        file: currentFile,
        content: currentContent,
        lines: currentLines,
      });
    }

    return changes;
  }

  /**
   * 计算差异指标
   */
  private calculateDiffMetrics(
    changes: Array<{
      file: string;
      content: string;
      lines: number[];
    }>
  ): CodeMetrics {
    const totalLines = changes.reduce((sum, change) => sum + change.lines.length, 0);

    return {
      linesOfCode: totalLines,
      complexity: 1,
      maintainabilityIndex: 85, // 默认值
    };
  }

  /**
   * 获取默认指标
   */
  private getDefaultMetrics(): CodeMetrics {
    return {
      linesOfCode: 0,
      complexity: 0,
      maintainabilityIndex: 0,
    };
  }

  /**
   * 获取默认摘要
   */
  private getDefaultSummary(): AnalysisSummary {
    return {
      totalIssues: 0,
      issuesBySeverity: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      },
      issuesByCategory: {
        security: 0,
        performance: 0,
        maintainability: 0,
        reliability: 0,
        style: 0,
        'best-practice': 0,
        bug: 0,
        complexity: 0,
      },
      score: 0,
      grade: 'F',
    };
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: ReviewRule): void {
    this.rules.push(rule);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
  }

  /**
   * 获取所有规则
   */
  getRules(): ReviewRule[] {
    return [...this.rules];
  }
}
