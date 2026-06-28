/**
 * 代码审查相关的类型定义
 */

// 问题严重程度
export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

// 问题类别
export type IssueCategory =
  | 'security' // 安全问题
  | 'performance' // 性能问题
  | 'maintainability' // 可维护性
  | 'reliability' // 可靠性
  | 'style' // 代码风格
  | 'best-practice' // 最佳实践
  | 'bug' // 潜在Bug
  | 'complexity'; // 复杂度

// 代码问题
export interface CodeIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
  autoFixable: boolean;
  references?: string[];
}

// 修复建议
export interface FixSuggestion {
  issueId: string;
  type: 'replace' | 'insert' | 'delete' | 'refactor';
  description: string;
  oldCode?: string;
  newCode?: string;
  confidence: number; // 0-1
}

// 分析结果
export interface AnalysisResult {
  file: string;
  issues: CodeIssue[];
  metrics: CodeMetrics;
  summary: AnalysisSummary;
}

// 代码指标
export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  testCoverage?: number;
  duplicateLines?: number;
}

// 分析摘要
export interface AnalysisSummary {
  totalIssues: number;
  issuesBySeverity: Record<IssueSeverity, number>;
  issuesByCategory: Record<IssueCategory, number>;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}
// 审查报告
export interface ReviewReport {
  id: string;
  timestamp: Date;
  type: ReviewType;
  target: string;
  results: AnalysisResult[];
  summary: ReviewSummary;
  suggestions: FixSuggestion[];
}

// 审查类型
export type ReviewType = 'file' | 'directory' | 'diff' | 'commit' | 'pr';

// 审查摘要
export interface ReviewSummary {
  totalFiles: number;
  totalIssues: number;
  criticalIssues: number;
  fixableIssues: number;
  overallScore: number;
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations: string[];
}

// 审查选项
export interface ReviewOptions {
  type: ReviewType;
  target: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  categories?: IssueCategory[];
  minSeverity?: IssueSeverity;
  autoFix?: boolean;
  outputFormat?: 'console' | 'json' | 'html' | 'markdown';
}
