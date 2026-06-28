import type { ModelService } from '../services/ModelService.js';
import type {
  AnalysisResult,
  ReviewReport,
  FixSuggestion,
  CodeIssue,
  ReviewSummary,
  ReviewType,
} from './types.js';

/**
 * 审查引擎
 *
 * 使用AI生成详细的审查报告和修复建议
 */
export class ReviewEngine {
  constructor(private modelService: ModelService) {}

  /**
   * 生成审查报告
   */
  async generateReview(
    results: AnalysisResult[],
    type: ReviewType,
    target: string
  ): Promise<ReviewReport> {
    const summary = this.generateReviewSummary(results);
    const suggestions = await this.generateFixSuggestions(results);

    return {
      id: `review-${Date.now()}`,
      timestamp: new Date(),
      type,
      target,
      results,
      summary,
      suggestions,
    };
  }

  /**
   * 生成修复建议
   */
  async generateFixSuggestions(results: AnalysisResult[]): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    for (const result of results) {
      for (const issue of result.issues) {
        if (issue.autoFixable) {
          const suggestion = await this.generateAIFixSuggestion(issue);
          if (suggestion) {
            suggestions.push(suggestion);
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * 使用AI生成修复建议
   */
  private async generateAIFixSuggestion(issue: CodeIssue): Promise<FixSuggestion | null> {
    try {
      const prompt = this.buildFixPrompt(issue);
      const response = await this.modelService.generateText(prompt);

      return this.parseFixResponse(response, issue);
    } catch (error) {
      console.error('生成修复建议失败:', error);
      return null;
    }
  }

  /**
   * 构建修复提示
   */
  private buildFixPrompt(issue: CodeIssue): string {
    return `
作为一个代码审查专家，请为以下代码问题提供修复建议：

问题类型: ${issue.category}
严重程度: ${issue.severity}
问题描述: ${issue.description}
文件: ${issue.file}
行号: ${issue.line}
代码: ${issue.code}

请提供：
1. 修复后的代码
2. 修复说明
3. 置信度（0-1）

请以JSON格式回复：
{
  "type": "replace|insert|delete|refactor",
  "description": "修复说明",
  "oldCode": "原代码",
  "newCode": "修复后的代码",
  "confidence": 0.9
}
`;
  }
  /**
   * 解析修复响应
   */
  private parseFixResponse(response: string, issue: CodeIssue): FixSuggestion | null {
    try {
      const parsed = JSON.parse(response);

      return {
        issueId: issue.id,
        type: parsed.type || 'replace',
        description: parsed.description || '自动修复建议',
        oldCode: parsed.oldCode || issue.code,
        newCode: parsed.newCode,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('解析修复响应失败:', error);
      return null;
    }
  }

  /**
   * 生成审查摘要
   */
  private generateReviewSummary(results: AnalysisResult[]): ReviewSummary {
    const totalFiles = results.length;
    const totalIssues = results.reduce((sum, result) => sum + result.issues.length, 0);
    const criticalIssues = results.reduce(
      (sum, result) => sum + result.issues.filter((issue) => issue.severity === 'critical').length,
      0
    );
    const fixableIssues = results.reduce(
      (sum, result) => sum + result.issues.filter((issue) => issue.autoFixable).length,
      0
    );

    // 计算总体分数
    const overallScore =
      totalFiles > 0
        ? results.reduce((sum, result) => sum + result.summary.score, 0) / totalFiles
        : 0;

    // 计算总体等级
    let overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (overallScore >= 90) overallGrade = 'A';
    else if (overallScore >= 80) overallGrade = 'B';
    else if (overallScore >= 70) overallGrade = 'C';
    else if (overallScore >= 60) overallGrade = 'D';
    else overallGrade = 'F';

    // 生成建议
    const recommendations = this.generateRecommendations(results);

    return {
      totalFiles,
      totalIssues,
      criticalIssues,
      fixableIssues,
      overallScore: Math.round(overallScore),
      overallGrade,
      recommendations,
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(results: AnalysisResult[]): string[] {
    const recommendations: string[] = [];

    const totalIssues = results.reduce((sum, result) => sum + result.issues.length, 0);
    const criticalIssues = results.reduce(
      (sum, result) => sum + result.issues.filter((issue) => issue.severity === 'critical').length,
      0
    );
    const securityIssues = results.reduce(
      (sum, result) => sum + result.issues.filter((issue) => issue.category === 'security').length,
      0
    );
    const performanceIssues = results.reduce(
      (sum, result) =>
        sum + result.issues.filter((issue) => issue.category === 'performance').length,
      0
    );

    if (criticalIssues > 0) {
      recommendations.push(`立即修复 ${criticalIssues} 个严重问题`);
    }

    if (securityIssues > 0) {
      recommendations.push(`关注 ${securityIssues} 个安全问题`);
    }

    if (performanceIssues > 0) {
      recommendations.push(`优化 ${performanceIssues} 个性能问题`);
    }

    if (totalIssues === 0) {
      recommendations.push('代码质量良好，继续保持');
    } else if (totalIssues < 5) {
      recommendations.push('代码质量较好，有少量改进空间');
    } else if (totalIssues < 20) {
      recommendations.push('建议逐步改进代码质量');
    } else {
      recommendations.push('建议进行全面的代码重构');
    }

    return recommendations;
  }

  /**
   * 生成AI增强的审查报告
   */
  async generateEnhancedReview(
    results: AnalysisResult[],
    type: ReviewType,
    target: string
  ): Promise<ReviewReport> {
    const baseReport = await this.generateReview(results, type, target);

    // 使用AI增强报告
    const enhancedSummary = await this.enhanceReportWithAI(baseReport);

    return {
      ...baseReport,
      summary: enhancedSummary,
    };
  }

  /**
   * 使用AI增强报告
   */
  private async enhanceReportWithAI(report: ReviewReport): Promise<ReviewSummary> {
    try {
      const prompt = this.buildEnhancementPrompt(report);
      const response = await this.modelService.generateText(prompt);

      const enhanced = JSON.parse(response);

      return {
        ...report.summary,
        recommendations: enhanced.recommendations || report.summary.recommendations,
      };
    } catch (error) {
      console.error('AI增强报告失败:', error);
      return report.summary;
    }
  }

  /**
   * 构建增强提示
   */
  private buildEnhancementPrompt(report: ReviewReport): string {
    const issuesSummary = report.results.map((result) => ({
      file: result.file,
      issues: result.issues.length,
      score: result.summary.score,
      categories: Object.entries(result.summary.issuesByCategory)
        .filter(([_, count]) => count > 0)
        .map(([category, count]) => `${category}: ${count}`)
        .join(', '),
    }));

    return `
作为代码审查专家，请基于以下审查结果提供专业建议：

审查类型: ${report.type}
目标: ${report.target}
总文件数: ${report.summary.totalFiles}
总问题数: ${report.summary.totalIssues}
严重问题: ${report.summary.criticalIssues}
可修复问题: ${report.summary.fixableIssues}
总体分数: ${report.summary.overallScore}
总体等级: ${report.summary.overallGrade}

文件详情:
${issuesSummary
  .map(
    (item) => `- ${item.file}: ${item.issues}个问题, 分数${item.score}, 类别[${item.categories}]`
  )
  .join('\n')}

请提供：
1. 优先级建议（哪些问题最需要先解决）
2. 改进策略（如何系统性地提升代码质量）
3. 最佳实践建议（避免类似问题的建议）

请以JSON格式回复：
{
  "recommendations": [
    "建议1",
    "建议2",
    "建议3"
  ]
}
`;
  }
}
