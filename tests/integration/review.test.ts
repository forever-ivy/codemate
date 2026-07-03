import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'pathe';
import { CodeAnalyzer } from '../../src/review/CodeAnalyzer.js';
import { ReviewEngine } from '../../src/review/ReviewEngine.js';
import type { ModelService } from '../../src/services/ModelService.js';

describe('Review System Integration', () => {
  let analyzer: CodeAnalyzer;
  let engine: ReviewEngine;
  let mockModelService: ModelService;
  let testDir: string;

  beforeEach(async () => {
    // 创建测试目录
    testDir = join(process.cwd(), 'test-review-temp');
    await mkdir(testDir, { recursive: true });

    // 创建模拟的ModelService
    mockModelService = {
      generateText: async (prompt: string) => {
        if (prompt.includes('修复建议')) {
          return JSON.stringify({
            type: 'replace',
            description: 'Replace console.log with logger',
            oldCode: 'console.log("test")',
            newCode: 'logger.info("test")',
            confidence: 0.9,
          });
        }

        if (prompt.includes('专业建议')) {
          return JSON.stringify({
            recommendations: ['优先修复安全问题', '改进代码可维护性', '添加单元测试覆盖'],
          });
        }

        return '{}';
      },
    } as any;

    analyzer = new CodeAnalyzer();
    engine = new ReviewEngine(mockModelService);
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  describe('File Analysis Integration', () => {
    it('should analyze a JavaScript file with issues', async () => {
      const testFile = join(testDir, 'test.js');
      const testCode = `
// Test file with various issues
console.log('Debug message');
var oldVariable = 'should use let/const';

function complexFunction() {
  if (condition1) {
    if (condition2) {
      while (condition3) {
        for (let i = 0; i < 10; i++) {
          if (condition4 && condition5) {
            console.log('Very nested');
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Potential security issue
const apiKey = "hardcoded-api-key-12345";
`;

      await writeFile(testFile, testCode);

      const result = await analyzer.analyzeFile(testFile);

      expect(result.file).toBe(testFile);
      expect(result.issues.length).toBeGreaterThan(0);

      // 检查是否检测到console.log问题
      const consoleIssues = result.issues.filter((issue) =>
        issue.description.includes('console.log')
      );
      expect(consoleIssues.length).toBeGreaterThan(0);

      // 检查是否检测到var声明问题
      const varIssues = result.issues.filter((issue) => issue.description.includes('var'));
      expect(varIssues.length).toBeGreaterThan(0);

      // 检查代码指标
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.complexity).toBeGreaterThan(1);
      expect(result.summary.totalIssues).toBeGreaterThan(0);
    });

    it('should analyze a TypeScript file', async () => {
      const testFile = join(testDir, 'test.ts');
      const testCode = `
interface User {
  name: string;
  email: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    console.log('Adding user:', user);
    this.users.push(user);
  }
  
  getUser(email: string): User | undefined {
    return this.users.find(u => u.email === email);
  }
}

var globalVar = new UserService();
`;

      await writeFile(testFile, testCode);

      const result = await analyzer.analyzeFile(testFile);

      expect(result.file).toBe(testFile);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
    });
  });

  describe('Directory Analysis Integration', () => {
    it('should analyze multiple files in a directory', async () => {
      // 创建多个测试文件
      const files = [
        { name: 'file1.js', content: 'console.log("file1"); var x = 1;' },
        { name: 'file2.ts', content: 'console.log("file2"); var y = 2;' },
        { name: 'file3.py', content: 'print("python file")' }, // 不会被分析
      ];

      for (const file of files) {
        await writeFile(join(testDir, file.name), file.content);
      }

      const results = await analyzer.analyzeDirectory(testDir);

      // 应该只分析JS/TS文件
      expect(results.length).toBe(2);

      // 每个文件都应该有问题
      for (const result of results) {
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it('should respect include/exclude patterns', async () => {
      // 创建测试文件
      await writeFile(join(testDir, 'include.js'), 'console.log("include");');
      await writeFile(join(testDir, 'exclude.js'), 'console.log("exclude");');
      await writeFile(join(testDir, 'other.ts'), 'console.log("other");');

      const results = await analyzer.analyzeDirectory(testDir, {
        includePatterns: ['include'],
        excludePatterns: ['exclude'],
      });

      expect(results.length).toBe(1);
      expect(results[0].file).toContain('include.js');
    });
  });

  describe('Review Engine Integration', () => {
    it('should generate complete review report', async () => {
      const testFile = join(testDir, 'review-test.js');
      const testCode = `
console.log('Test');
var testVar = 'test';
function testFunc() {
  if (true) {
    console.log('nested');
  }
}
`;

      await writeFile(testFile, testCode);

      const analysisResults = [await analyzer.analyzeFile(testFile)];
      const report = await engine.generateEnhancedReview(analysisResults, 'file', testFile);

      expect(report.id).toMatch(/^review-\d+$/);
      expect(report.type).toBe('file');
      expect(report.target).toBe(testFile);
      expect(report.results).toEqual(analysisResults);
      expect(report.summary.totalFiles).toBe(1);
      expect(report.summary.totalIssues).toBeGreaterThan(0);
      expect(report.suggestions.length).toBeGreaterThan(0);

      // 检查AI增强的建议
      expect(report.summary.recommendations).toContain('优先修复安全问题');
    });

    it('should handle files with no issues', async () => {
      const testFile = join(testDir, 'clean.js');
      const testCode = `
// Clean JavaScript code
const message = 'Hello World';

function greet(name) {
  return \`Hello, \${name}!\`;
}

export { greet };
`;

      await writeFile(testFile, testCode);

      const analysisResults = [await analyzer.analyzeFile(testFile)];
      const report = await engine.generateReview(analysisResults, 'file', testFile);

      expect(report.summary.totalIssues).toBe(0);
      expect(report.summary.overallScore).toBeGreaterThan(80);
      expect(report.summary.overallGrade).toMatch(/[A-C]/);
    });
  });

  describe('Diff Analysis Integration', () => {
    it('should analyze git diff format', async () => {
      const mockDiff = `
diff --git a/test.js b/test.js
index 1234567..abcdefg 100644
--- a/test.js
+++ b/test.js
@@ -1,3 +1,5 @@
 function test() {
+  console.log('new debug line');
+  var newVar = 'test';
   return true;
 }
`;

      const result = await analyzer.analyzeDiff(mockDiff);

      expect(result.file).toBe('diff');
      expect(result.issues.length).toBeGreaterThan(0);

      // 应该检测到新增的问题
      const consoleIssues = result.issues.filter((issue) =>
        issue.description.includes('console.log')
      );
      expect(consoleIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Rules Integration', () => {
    it('should work with custom rules', async () => {
      const customRule = {
        id: 'no-todo-comments',
        name: 'No TODO Comments',
        description: 'Avoid TODO comments in production code',
        category: 'maintainability' as const,
        severity: 'info' as const,
        async check(code: string) {
          const violations = [];
          const lines = code.split('\n');

          lines.forEach((line, index) => {
            if (line.includes('TODO') || line.includes('FIXME')) {
              violations.push({
                line: index + 1,
                message: 'TODO/FIXME comments should be resolved',
                suggestion: 'Create a proper issue or fix immediately',
                autoFixable: false,
              });
            }
          });

          return violations;
        },
      };

      analyzer.addRule(customRule);

      const testFile = join(testDir, 'todo-test.js');
      const testCode = `
function test() {
  // TODO: implement this function
  // FIXME: handle edge cases
  return true;
}
`;

      await writeFile(testFile, testCode);

      const result = await analyzer.analyzeFile(testFile);

      const todoIssues = result.issues.filter((issue) => issue.title === 'No TODO Comments');
      expect(todoIssues.length).toBe(2);
    });
  });
});
