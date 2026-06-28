/**
 * 代码审查规则定义
 */

import type { IssueCategory, IssueSeverity } from './types.js';

export interface ReviewRule {
  id: string;
  name: string;
  description: string;
  category: IssueCategory;
  severity: IssueSeverity;
  pattern?: RegExp;
  check: (code: string, context: RuleContext) => Promise<RuleViolation[]>;
}

export interface RuleContext {
  file: string;
  language: string;
  lines: string[];
  ast?: any;
}

export interface RuleViolation {
  line: number;
  column?: number;
  message: string;
  suggestion?: string;
  autoFixable: boolean;
}

// 内置规则
export const BUILTIN_RULES: ReviewRule[] = [
  {
    id: 'no-console-log',
    name: 'No Console Log',
    description: '避免在生产代码中使用 console.log',
    category: 'best-practice',
    severity: 'warning',
    pattern: /console\.(log|debug|info|warn|error)/,
    async check(code: string, _context: RuleContext): Promise<RuleViolation[]> {
      const violations: RuleViolation[] = [];
      const lines = code.split('\n');

      lines.forEach((line, index) => {
        const match = line.match(/console\.(log|debug|info|warn|error)/);
        if (match) {
          violations.push({
            line: index + 1,
            column: match.index,
            message: `避免使用 console.${match[1]}，考虑使用日志库`,
            suggestion: `使用 logger.${match[1]}() 替代`,
            autoFixable: true,
          });
        }
      });

      return violations;
    },
  },

  {
    id: 'no-var-declaration',
    name: 'No Var Declaration',
    description: '使用 let 或 const 替代 var',
    category: 'best-practice',
    severity: 'warning',
    pattern: /\bvar\s+/,
    async check(code: string, _context: RuleContext): Promise<RuleViolation[]> {
      const violations: RuleViolation[] = [];
      const lines = code.split('\n');

      lines.forEach((line, index) => {
        const match = line.match(/\bvar\s+(\w+)/);
        if (match) {
          violations.push({
            line: index + 1,
            column: match.index,
            message: '使用 let 或 const 替代 var',
            suggestion: `使用 const ${match[1]} 或 let ${match[1]}`,
            autoFixable: true,
          });
        }
      });

      return violations;
    },
  },

  {
    id: 'no-hardcoded-secrets',
    name: 'No Hardcoded Secrets',
    description: '检查硬编码的密钥和敏感信息',
    category: 'security',
    severity: 'critical',
    async check(code: string, _context: RuleContext): Promise<RuleViolation[]> {
      const violations: RuleViolation[] = [];
      const lines = code.split('\n');

      const secretPatterns = [
        /(?:password|pwd|pass)\s*[:=]\s*['"][^'"]+['"]/i,
        /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/i,
        /(?:secret|token)\s*[:=]\s*['"][^'"]+['"]/i,
        /(?:private[_-]?key)\s*[:=]\s*['"][^'"]+['"]/i,
      ];

      lines.forEach((line, index) => {
        secretPatterns.forEach((pattern) => {
          const match = line.match(pattern);
          if (match) {
            violations.push({
              line: index + 1,
              column: match.index,
              message: '检测到可能的硬编码敏感信息',
              suggestion: '使用环境变量或配置文件存储敏感信息',
              autoFixable: false,
            });
          }
        });
      });

      return violations;
    },
  },

  {
    id: 'no-eval',
    name: 'No Eval',
    description: '避免使用 eval() 函数',
    category: 'security',
    severity: 'error',
    pattern: /\beval\s*\(/,
    async check(code: string, _context: RuleContext): Promise<RuleViolation[]> {
      const violations: RuleViolation[] = [];
      const lines = code.split('\n');

      lines.forEach((line, index) => {
        const match = line.match(/\beval\s*\(/);
        if (match) {
          violations.push({
            line: index + 1,
            column: match.index,
            message: '避免使用 eval()，存在安全风险',
            suggestion: '使用更安全的替代方案，如 JSON.parse() 或函数调用',
            autoFixable: false,
          });
        }
      });

      return violations;
    },
  },

  {
    id: 'function-complexity',
    name: 'Function Complexity',
    description: '检查函数复杂度',
    category: 'complexity',
    severity: 'warning',
    async check(code: string, _context: RuleContext): Promise<RuleViolation[]> {
      const violations: RuleViolation[] = [];
      const lines = code.split('\n');

      let currentFunction = '';
      let functionStart = 0;
      let braceCount = 0;
      let complexity = 1;

      lines.forEach((line, index) => {
        const functionMatch = line.match(
          /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/
        );

        if (functionMatch && braceCount === 0) {
          currentFunction = functionMatch[1] || functionMatch[2];
          functionStart = index + 1;
          complexity = 1;
        }

        // 计算复杂度
        const complexityKeywords = [
          'if',
          'else',
          'while',
          'for',
          'switch',
          'case',
          'catch',
          '&&',
          '||',
          '?',
        ];
        complexityKeywords.forEach((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'g');
          const matches = line.match(regex);
          if (matches) {
            complexity += matches.length;
          }
        });

        // 跟踪大括号
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        // 函数结束
        if (braceCount === 0 && currentFunction && complexity > 10) {
          violations.push({
            line: functionStart,
            message: `函数 ${currentFunction} 复杂度过高 (${complexity})`,
            suggestion: '考虑将函数拆分为更小的函数',
            autoFixable: false,
          });
        }
      });

      return violations;
    },
  },
];
