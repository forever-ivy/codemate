import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import { CodeAnalyzer } from '../../review/CodeAnalyzer.js';
import { ReviewEngine } from '../../review/ReviewEngine.js';
import type { ModelService } from '../../services/ModelService.js';
import type { ReviewOptions, ReviewReport } from '../../review/types.js';
import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve } from 'pathe';

/**
 * Review 命令
 *
 * 用法：
 * /review                           # 审查当前目录
 * /review src/utils/helper.ts       # 审查指定文件
 * /review src/components/           # 审查目录
 * /review --diff                    # 审查Git差异
 * /review --commit HEAD             # 审查提交
 * /review --security src/           # 安全审查
 * /review --performance src/        # 性能审查
 */
export class ReviewCommand extends SlashCommand {
  name = 'review';
  description = 'AI-powered code review';
  aliases = ['r'];

  private analyzer: CodeAnalyzer;
  private engine?: ReviewEngine;

  constructor() {
    super();
    this.analyzer = new CodeAnalyzer();
  }

  async execute(args: string[], app: Application): Promise<void> {
    try {
      // 获取ModelService
      const modelService = app.getContainer().get<ModelService>('model');
      this.engine = new ReviewEngine(modelService);

      if (args.length > 0 && (args[0] === 'help' || args[0] === '--help')) {
        this.showHelp();
        return;
      }

      const options = this.parseOptions(args);

      console.log(`🔍 开始代码审查: ${options.target}`);
      console.log(`📋 审查类型: ${options.type}`);

      if (options.categories && options.categories.length > 0) {
        console.log(`🏷️  关注类别: ${options.categories.join(', ')}`);
      }

      // 执行审查
      const results = await this.performReview(options);

      // 生成报告
      const report = await this.engine.generateEnhancedReview(
        results,
        options.type,
        options.target
      );

      // 显示结果
      await this.displayReport(report, options);

      // 自动修复（如果启用）
      if (options.autoFix && report.suggestions.length > 0) {
        await this.handleAutoFix(report.suggestions);
      }
    } catch (error) {
      console.error('❌ 代码审查失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 解析命令选项
   */
  private parseOptions(args: string[]): ReviewOptions {
    const options: ReviewOptions = {
      type: 'directory',
      target: process.cwd(),
      outputFormat: 'console',
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      switch (arg) {
        case '--diff':
          options.type = 'diff';
          options.target = this.getGitDiff();
          break;

        case '--commit':
          options.type = 'commit';
          options.target = args[++i] || 'HEAD';
          break;

        case '--security':
          options.categories = ['security'];
          if (args[i + 1] && !args[i + 1].startsWith('--')) {
            options.target = args[++i];
          }
          break;

        case '--performance':
          options.categories = ['performance'];
          if (args[i + 1] && !args[i + 1].startsWith('--')) {
            options.target = args[++i];
          }
          break;

        case '--auto-fix':
          options.autoFix = true;
          break;

        case '--format':
          options.outputFormat = args[++i] as any;
          break;

        case '--include':
          options.includePatterns = args[++i].split(',');
          break;

        case '--exclude':
          options.excludePatterns = args[++i].split(',');
          break;

        case '--min-severity':
          options.minSeverity = args[++i] as any;
          break;

        default:
          if (!arg.startsWith('--')) {
            options.target = arg;
            // 判断是文件还是目录
            const fullPath = resolve(arg);
            if (existsSync(fullPath)) {
              const stats = statSync(fullPath);
              options.type = stats.isDirectory() ? 'directory' : 'file';
            }
          }
          break;
      }
      i++;
    }

    return options;
  }
  /**
   * 执行审查
   */
  private async performReview(options: ReviewOptions) {
    switch (options.type) {
      case 'file':
        return [await this.analyzer.analyzeFile(options.target)];

      case 'directory':
        return await this.analyzer.analyzeDirectory(options.target, {
          includePatterns: options.includePatterns,
          excludePatterns: options.excludePatterns,
          recursive: true,
        });

      case 'diff':
        return [await this.analyzer.analyzeDiff(options.target)];

      case 'commit':
        const commitDiff = this.getCommitDiff(options.target);
        return [await this.analyzer.analyzeDiff(commitDiff)];

      default:
        throw new Error(`不支持的审查类型: ${options.type}`);
    }
  }

  /**
   * 显示审查报告
   */
  private async displayReport(report: ReviewReport, options: ReviewOptions): Promise<void> {
    switch (options.outputFormat) {
      case 'console':
        this.displayConsoleReport(report);
        break;
      case 'json':
        console.log(JSON.stringify(report, null, 2));
        break;
      case 'markdown':
        this.displayMarkdownReport(report);
        break;
      default:
        this.displayConsoleReport(report);
    }
  }

  /**
   * 显示控制台报告
   */
  private displayConsoleReport(report: ReviewReport): void {
    console.log('\n📊 审查报告');
    console.log('='.repeat(50));

    // 总体摘要
    console.log(
      `\n📈 总体评分: ${report.summary.overallScore}/100 (${report.summary.overallGrade})`
    );
    console.log(`📁 审查文件: ${report.summary.totalFiles} 个`);
    console.log(`🐛 发现问题: ${report.summary.totalIssues} 个`);
    console.log(`🚨 严重问题: ${report.summary.criticalIssues} 个`);
    console.log(`🔧 可修复: ${report.summary.fixableIssues} 个`);

    // 问题分布
    if (report.summary.totalIssues > 0) {
      console.log('\n📋 问题分布:');

      for (const result of report.results) {
        if (result.issues.length > 0) {
          console.log(`\n📄 ${result.file} (评分: ${result.summary.score}/100)`);

          const issuesByCategory = result.summary.issuesByCategory;
          Object.entries(issuesByCategory).forEach(([category, count]) => {
            if (count > 0) {
              console.log(`  ${this.getCategoryIcon(category)} ${category}: ${count} 个`);
            }
          });

          // 显示前3个问题
          const topIssues = result.issues
            .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
            .slice(0, 3);

          topIssues.forEach((issue) => {
            console.log(
              `    ${this.getSeverityIcon(issue.severity)} 第${issue.line}行: ${issue.description}`
            );
            if (issue.suggestion) {
              console.log(`      💡 建议: ${issue.suggestion}`);
            }
          });
        }
      }
    }

    // 建议
    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      report.summary.recommendations.forEach((rec: string, index: number) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // 修复建议
    if (report.suggestions.length > 0) {
      console.log(`\n🔧 自动修复建议 (${report.suggestions.length} 个):`);
      report.suggestions.slice(0, 5).forEach((suggestion: any, index: number) => {
        console.log(
          `  ${index + 1}. ${suggestion.description} (置信度: ${Math.round(suggestion.confidence * 100)}%)`
        );
      });

      if (report.suggestions.length > 5) {
        console.log(`  ... 还有 ${report.suggestions.length - 5} 个建议`);
      }
    }

    console.log('\n✅ 审查完成');
  }

  /**
   * 显示Markdown报告
   */
  private displayMarkdownReport(report: ReviewReport): void {
    console.log('# 代码审查报告\n');
    console.log(`**审查时间**: ${report.timestamp.toLocaleString()}\n`);
    console.log(`**审查目标**: ${report.target}\n`);
    console.log(
      `**总体评分**: ${report.summary.overallScore}/100 (${report.summary.overallGrade})\n`
    );

    console.log('## 摘要\n');
    console.log(`- 审查文件: ${report.summary.totalFiles} 个`);
    console.log(`- 发现问题: ${report.summary.totalIssues} 个`);
    console.log(`- 严重问题: ${report.summary.criticalIssues} 个`);
    console.log(`- 可修复: ${report.summary.fixableIssues} 个\n`);

    if (report.summary.totalIssues > 0) {
      console.log('## 详细问题\n');

      for (const result of report.results) {
        if (result.issues.length > 0) {
          console.log(`### ${result.file}\n`);
          console.log(`**评分**: ${result.summary.score}/100\n`);

          result.issues.forEach((issue: any) => {
            console.log(`- **第${issue.line}行** [${issue.severity}] ${issue.description}`);
            if (issue.suggestion) {
              console.log(`  - 💡 建议: ${issue.suggestion}`);
            }
          });
          console.log('');
        }
      }
    }

    if (report.summary.recommendations.length > 0) {
      console.log('## 改进建议\n');
      report.summary.recommendations.forEach((rec: string, index: number) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
  }

  /**
   * 处理自动修复
   */
  private async handleAutoFix(suggestions: any[]): Promise<void> {
    console.log('\n🔧 自动修复建议:');

    const highConfidenceSuggestions = suggestions.filter((s) => s.confidence > 0.8);

    if (highConfidenceSuggestions.length > 0) {
      console.log(`\n发现 ${highConfidenceSuggestions.length} 个高置信度修复建议:`);

      highConfidenceSuggestions.forEach((suggestion, index) => {
        console.log(
          `${index + 1}. ${suggestion.description} (置信度: ${Math.round(suggestion.confidence * 100)}%)`
        );
      });

      console.log('\n💡 提示: 使用 --auto-fix 参数可以自动应用这些修复');
    } else {
      console.log('暂无高置信度的自动修复建议');
    }
  }

  /**
   * 获取Git差异
   */
  private getGitDiff(): string {
    try {
      return (
        execSync('git diff --staged', { encoding: 'utf-8' }) ||
        execSync('git diff', { encoding: 'utf-8' })
      );
    } catch (error) {
      throw new Error('无法获取Git差异，请确保在Git仓库中');
    }
  }

  /**
   * 获取提交差异
   */
  private getCommitDiff(commit: string): string {
    try {
      return execSync(`git show ${commit}`, { encoding: 'utf-8' });
    } catch (error) {
      throw new Error(`无法获取提交 ${commit} 的差异`);
    }
  }

  /**
   * 获取严重程度权重
   */
  private getSeverityWeight(severity: string): number {
    const weights = { critical: 4, error: 3, warning: 2, info: 1 };
    return weights[severity as keyof typeof weights] || 0;
  }

  /**
   * 获取严重程度图标
   */
  private getSeverityIcon(severity: string): string {
    const icons = {
      critical: '🚨',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    return icons[severity as keyof typeof icons] || '❓';
  }

  /**
   * 获取类别图标
   */
  private getCategoryIcon(category: string): string {
    const icons = {
      security: '🔒',
      performance: '⚡',
      maintainability: '🔧',
      reliability: '🛡️',
      style: '🎨',
      'best-practice': '✨',
      bug: '🐛',
      complexity: '🧩',
    };
    return icons[category as keyof typeof icons] || '📋';
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log('🔍 Review 命令使用说明');
    console.log('');
    console.log('用法: /review [target] [options]');
    console.log('');
    console.log('目标:');
    console.log('  <file>              审查指定文件');
    console.log('  <directory>         审查指定目录');
    console.log('  --diff              审查Git差异');
    console.log('  --commit <hash>     审查指定提交');
    console.log('');
    console.log('选项:');
    console.log('  --security          只检查安全问题');
    console.log('  --performance       只检查性能问题');
    console.log('  --auto-fix          自动应用修复建议');
    console.log('  --format <type>     输出格式 (console|json|markdown)');
    console.log('  --include <patterns> 包含文件模式 (逗号分隔)');
    console.log('  --exclude <patterns> 排除文件模式 (逗号分隔)');
    console.log('  --min-severity <level> 最小严重程度 (info|warning|error|critical)');
    console.log('');
    console.log('示例:');
    console.log('  /review                    # 审查当前目录');
    console.log('  /review src/utils/helper.ts # 审查指定文件');
    console.log('  /review src/ --security    # 安全审查');
    console.log('  /review --diff             # 审查Git差异');
    console.log('  /review --commit HEAD~1    # 审查上一个提交');
  }
}
