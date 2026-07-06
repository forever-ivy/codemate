import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrainstormSession } from '../../../src/spec/brainstorm/BrainstormSession.js';
import { EventBus } from '../../../src/services/EventBus.js';
import type { BrainstormQuestion } from '../../../src/spec/brainstorm/types.js';

// Mock ModelService
const mockModelService = {
  chat: vi.fn().mockResolvedValue('{"test": "response"}'),
};

// Mock AIAnalyzer
vi.mock('../../../src/spec/brainstorm/AIAnalyzer.js', () => ({
  AIAnalyzer: vi.fn().mockImplementation(() => ({
    generateQuestions: vi.fn().mockResolvedValue([
      {
        id: 'q1',
        type: 'open',
        question: '请描述项目的主要功能',
        required: true,
        weight: 10,
        category: 'functional',
      },
      {
        id: 'q2',
        type: 'choice',
        question: '预期用户规模',
        choices: ['小型', '中型', '大型'],
        required: true,
        weight: 8,
        category: 'business',
      },
    ] as BrainstormQuestion[]),
    generateCompleteAnalysis: vi.fn().mockResolvedValue({
      topicAnalysis: {
        projectType: '测试项目',
        complexity: 'medium',
        keywords: ['测试', '项目'],
        suggestedTech: ['JavaScript', 'Node.js'],
      },
      functionalRequirements: {
        core: ['核心功能1', '核心功能2'],
        extended: ['扩展功能1'],
        optional: ['可选功能1'],
      },
      nonFunctionalRequirements: {
        performance: ['性能要求1'],
        security: ['安全要求1'],
        usability: ['可用性要求1'],
      },
      technicalRecommendations: {
        architecture: 'MVC',
        techStack: ['JavaScript'],
        database: ['PostgreSQL'],
        deployment: ['Docker'],
      },
      riskAssessment: {
        technical: ['技术风险1'],
        business: ['业务风险1'],
        timeline: ['时间风险1'],
      },
    }),
    analyzeResponses: vi.fn().mockResolvedValue({
      insights: ['洞察1', '洞察2'],
      nextQuestions: [],
      confidence: 0.8,
    }),
  })),
}));

describe('BrainstormSession', () => {
  let session: BrainstormSession;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    session = new BrainstormSession('测试项目', eventBus, mockModelService as any);
    vi.clearAllMocks();
  });

  describe('会话初始化', () => {
    it('应该正确初始化会话', () => {
      const sessionData = session.getSession();

      expect(sessionData.topic).toBe('测试项目');
      expect(sessionData.state).toBe('initializing');
      expect(sessionData.questions).toEqual([]);
      expect(sessionData.responses).toEqual([]);
      expect(sessionData.id).toBeDefined();
      expect(sessionData.createdAt).toBeInstanceOf(Date);
      expect(sessionData.updatedAt).toBeInstanceOf(Date);
    });

    it('应该生成唯一的会话ID', () => {
      const session1 = new BrainstormSession('项目1', eventBus, mockModelService as any);
      const session2 = new BrainstormSession('项目2', eventBus, mockModelService as any);

      expect(session1.getSession().id).not.toBe(session2.getSession().id);
    });
  });

  describe('会话启动', () => {
    it('应该能成功启动会话', async () => {
      const eventSpy = vi.fn();
      eventBus.on('brainstorm_event', eventSpy);

      await session.start();

      const sessionData = session.getSession();
      expect(sessionData.state).toBe('questioning');
      expect(sessionData.questions.length).toBeGreaterThan(0);
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_started',
        })
      );
    });

    it('应该在启动失败时设置取消状态', async () => {
      // 模拟 AIAnalyzer 抛出错误
      const errorSession = new BrainstormSession('错误项目', eventBus, mockModelService as any);

      // 重新 mock AIAnalyzer 使其抛出错误
      const { AIAnalyzer } = await import('../../../src/spec/brainstorm/AIAnalyzer.js');
      const mockAnalyzer = new (AIAnalyzer as any)(mockModelService);
      mockAnalyzer.generateQuestions = vi.fn().mockRejectedValue(new Error('测试错误'));

      try {
        await errorSession.start();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(errorSession.getSession().state).toBe('cancelled');
      }
    });
  });

  describe('问题管理', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('应该能获取下一个问题', () => {
      const nextQuestion = session.getNextQuestion();

      expect(nextQuestion).toBeDefined();
      expect(nextQuestion?.id).toBeDefined();
      expect(nextQuestion?.question).toBeDefined();
    });

    it('应该按优先级返回问题', () => {
      const sessionData = session.getSession();

      // 确保有问题
      expect(sessionData.questions.length).toBeGreaterThan(0);

      const nextQuestion = session.getNextQuestion();
      expect(nextQuestion?.required).toBe(true); // 必答问题优先
    });

    it('应该在没有未回答问题时返回null', async () => {
      // 回答所有问题
      const sessionData = session.getSession();
      for (const question of sessionData.questions) {
        let answer = '测试回答';

        // 为选择题提供有效答案
        if (question.type === 'choice' && question.choices && question.choices.length > 0) {
          answer = question.choices[0];
        }

        await session.answerQuestion(question.id, answer);
      }

      const nextQuestion = session.getNextQuestion();
      expect(nextQuestion).toBeNull();
    });
  });

  describe('回答问题', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('应该能成功回答问题', async () => {
      const question = session.getNextQuestion();
      expect(question).toBeDefined();

      if (question) {
        await session.answerQuestion(question.id, '测试回答');

        const sessionData = session.getSession();
        const response = sessionData.responses.find((r) => r.questionId === question.id);

        expect(response).toBeDefined();
        expect(response?.answer).toBe('测试回答');
        expect(response?.timestamp).toBeInstanceOf(Date);
      }
    });

    it('应该拒绝空的必答问题', async () => {
      const question = session.getNextQuestion();

      if (question && question.required) {
        await expect(session.answerQuestion(question.id, '')).rejects.toThrow('必答问题不能为空');
      }
    });

    it('应该验证选择题答案', async () => {
      const sessionData = session.getSession();
      const choiceQuestion = sessionData.questions.find((q) => q.type === 'choice');

      if (choiceQuestion && choiceQuestion.choices) {
        // 有效选择
        await session.answerQuestion(choiceQuestion.id, choiceQuestion.choices[0]);

        // 无效选择
        await expect(session.answerQuestion(choiceQuestion.id, '无效选择')).rejects.toThrow(
          '无效的选择'
        );
      }
    });

    it('应该拒绝不存在的问题', async () => {
      await expect(session.answerQuestion('不存在的问题', '回答')).rejects.toThrow('问题不存在');
    });
  });

  describe('会话进度', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('应该正确计算进度', async () => {
      const initialProgress = session.getProgress();
      expect(initialProgress.answeredQuestions).toBe(0);
      expect(initialProgress.percentage).toBe(0);

      // 回答一个问题
      const question = session.getNextQuestion();
      if (question) {
        await session.answerQuestion(question.id, '测试回答');

        const updatedProgress = session.getProgress();
        expect(updatedProgress.answeredQuestions).toBe(1);
        expect(updatedProgress.percentage).toBeGreaterThan(0);
      }
    });

    it('应该返回当前状态', () => {
      const progress = session.getProgress();
      expect(progress.currentState).toBe('questioning');
    });
  });

  describe('会话完成', () => {
    beforeEach(async () => {
      await session.start();
    });

    it('应该能完成问答阶段', async () => {
      await session.completeQuestioning();

      const sessionData = session.getSession();
      expect(sessionData.state).toBe('generating');
      expect(sessionData.analysis).toBeDefined();
    });

    it('应该能生成规格文档', async () => {
      await session.completeQuestioning();

      const specRequest = await session.generateSpec({
        includeTechnicalDetails: true,
        includeImplementationPlan: true,
        includeRiskAssessment: true,
        detailLevel: 'detailed',
        audience: 'developer',
      });

      expect(specRequest).toBeDefined();
      expect(specRequest.title).toBeDefined();
      expect(specRequest.description).toBeDefined();
      expect(specRequest.content).toBeDefined();
      expect(specRequest.tags).toBeDefined();

      const sessionData = session.getSession();
      expect(sessionData.state).toBe('completed');
      expect(sessionData.completedAt).toBeInstanceOf(Date);
    });

    it('应该在没有分析时拒绝生成规格', async () => {
      await expect(
        session.generateSpec({
          includeTechnicalDetails: true,
          includeImplementationPlan: true,
          includeRiskAssessment: true,
          detailLevel: 'detailed',
          audience: 'developer',
        })
      ).rejects.toThrow('需要先完成分析阶段');
    });
  });

  describe('会话取消', () => {
    it('应该能取消会话', () => {
      const eventSpy = vi.fn();
      eventBus.on('brainstorm_event', eventSpy);

      session.cancel();

      const sessionData = session.getSession();
      expect(sessionData.state).toBe('cancelled');
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_cancelled',
        })
      );
    });
  });
});
