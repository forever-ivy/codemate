import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewEngine } from '../../../src/review/ReviewEngine.js';
import type { ModelService } from '../../../src/services/ModelService.js';
import type { AnalysisResult, CodeIssue } from '../../../src/review/types.js';

describe('ReviewEngine', () => {
  let engine: ReviewEngine;
  let mockModelService: ModelService;

  beforeEach(() => {
    mockModelService = {
      generateText: vi.fn(),
    } as any;

    engine = new ReviewEngine(mockModelService);
  });

  describe('generateReview', () => {
    it('should generate a complete review report', async () => {
      const mockResults: AnalysisResult[] = [
        {
          file: 'test.js',
          issues: [
            {
              id: '1',
              severity: 'warning',
              category: 'best-practice',
              title: 'Console Log',
              description: 'Avoid console.log',
              file: 'test.js',
              line: 1,
              autoFixable: true,
            },
          ],
          metrics: {
            linesOfCode: 50,
            complexity: 3,
            maintainabilityIndex: 85,
          },
          summary: {
            totalIssues: 1,
            issuesBySeverity: {
              info: 0,
              warning: 1,
              error: 0,
              critical: 0,
            },
            issuesByCategory: {
              security: 0,
              performance: 0,
              maintainability: 0,
              reliability: 0,
              style: 0,
              'best-practice': 1,
              bug: 0,
              complexity: 0,
            },
            score: 85,
            grade: 'B',
          },
        },
      ];

      const report = await engine.generateReview(mockResults, 'file', 'test.js');

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^review-\d+$/);
      expect(report.type).toBe('file');
      expect(report.target).toBe('test.js');
      expect(report.results).toEqual(mockResults);
      expect(report.summary).toBeDefined();
      expect(report.suggestions).toBeInstanceOf(Array);
    });
  });

  describe('generateFixSuggestions', () => {
    it('should generate fix suggestions for auto-fixable issues', async () => {
      vi.mocked(mockModelService.generateText).mockResolvedValue(
        JSON.stringify({
          type: 'replace',
          description: 'Replace console.log with logger',
          oldCode: 'console.log("test")',
          newCode: 'logger.info("test")',
          confidence: 0.9,
        })
      );

      const mockResults: AnalysisResult[] = [
        {
          file: 'test.js',
          issues: [
            {
              id: '1',
              severity: 'warning',
              category: 'best-practice',
              title: 'Console Log',
              description: 'Avoid console.log',
              file: 'test.js',
              line: 1,
              autoFixable: true,
            },
          ],
          metrics: {
            linesOfCode: 50,
            complexity: 3,
            maintainabilityIndex: 85,
          },
          summary: {
            totalIssues: 1,
            issuesBySeverity: {
              info: 0,
              warning: 1,
              error: 0,
              critical: 0,
            },
            issuesByCategory: {
              security: 0,
              performance: 0,
              maintainability: 0,
              reliability: 0,
              style: 0,
              'best-practice': 1,
              bug: 0,
              complexity: 0,
            },
            score: 85,
            grade: 'B',
          },
        },
      ];

      const suggestions = await engine.generateFixSuggestions(mockResults);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toMatchObject({
        issueId: '1',
        type: 'replace',
        description: 'Replace console.log with logger',
        confidence: 0.9,
      });
    });

    it('should handle AI generation errors gracefully', async () => {
      vi.mocked(mockModelService.generateText).mockRejectedValue(
        new Error('AI service unavailable')
      );

      const mockResults: AnalysisResult[] = [
        {
          file: 'test.js',
          issues: [
            {
              id: '1',
              severity: 'warning',
              category: 'best-practice',
              title: 'Console Log',
              description: 'Avoid console.log',
              file: 'test.js',
              line: 1,
              autoFixable: true,
            },
          ],
          metrics: {
            linesOfCode: 50,
            complexity: 3,
            maintainabilityIndex: 85,
          },
          summary: {
            totalIssues: 1,
            issuesBySeverity: {
              info: 0,
              warning: 1,
              error: 0,
              critical: 0,
            },
            issuesByCategory: {
              security: 0,
              performance: 0,
              maintainability: 0,
              reliability: 0,
              style: 0,
              'best-practice': 1,
              bug: 0,
              complexity: 0,
            },
            score: 85,
            grade: 'B',
          },
        },
      ];

      const suggestions = await engine.generateFixSuggestions(mockResults);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('generateEnhancedReview', () => {
    it('should generate enhanced review with AI recommendations', async () => {
      vi.mocked(mockModelService.generateText)
        .mockResolvedValueOnce(
          JSON.stringify({
            type: 'replace',
            description: 'Replace console.log with logger',
            oldCode: 'console.log("test")',
            newCode: 'logger.info("test")',
            confidence: 0.9,
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            recommendations: ['优先修复安全问题', '改进代码可维护性', '添加单元测试'],
          })
        );

      const mockResults: AnalysisResult[] = [
        {
          file: 'test.js',
          issues: [
            {
              id: '1',
              severity: 'warning',
              category: 'best-practice',
              title: 'Console Log',
              description: 'Avoid console.log',
              file: 'test.js',
              line: 1,
              autoFixable: true,
            },
          ],
          metrics: {
            linesOfCode: 50,
            complexity: 3,
            maintainabilityIndex: 85,
          },
          summary: {
            totalIssues: 1,
            issuesBySeverity: {
              info: 0,
              warning: 1,
              error: 0,
              critical: 0,
            },
            issuesByCategory: {
              security: 0,
              performance: 0,
              maintainability: 0,
              reliability: 0,
              style: 0,
              'best-practice': 1,
              bug: 0,
              complexity: 0,
            },
            score: 85,
            grade: 'B',
          },
        },
      ];

      const report = await engine.generateEnhancedReview(mockResults, 'file', 'test.js');

      expect(report.summary.recommendations).toEqual([
        '优先修复安全问题',
        '改进代码可维护性',
        '添加单元测试',
      ]);
    });
  });
});
