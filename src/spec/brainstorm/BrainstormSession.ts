import { nanoid } from 'nanoid';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import { AIAnalyzer } from './AIAnalyzer.js';
import type {
  BrainstormSession as IBrainstormSession,
  BrainstormQuestion,
  BrainstormResponse,
  BrainstormSessionState,
  AIAnalysis,
  SpecGenerationOptions,
} from './types.js';
import type { CreateSpecRequest } from '../types.js';

/**
 * 头脑风暴会话管理器
 *
 * 职责：
 * 1. 管理头脑风暴会话生命周期
 * 2. 协调AI分析和用户交互
 * 3. 生成规格文档
 */
export class BrainstormSession {
  private session: IBrainstormSession;
  private aiAnalyzer: AIAnalyzer;

  constructor(
    topic: string,
    private eventBus: EventBus,
    private modelService: ModelService
  ) {
    this.session = {
      id: nanoid(),
      topic,
      state: 'initializing',
      questions: [],
      responses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.aiAnalyzer = new AIAnalyzer(modelService);
  }

  /**
   * 获取会话信息
   */
  getSession(): IBrainstormSession {
    return { ...this.session };
  }

  /**
   * 开始头脑风暴会话
   */
  async start(): Promise<void> {
    this.updateState('questioning');

    try {
      // 生成初始问题
      const questions = await this.aiAnalyzer.generateQuestions(this.session.topic);
      this.session.questions = questions;
      this.session.updatedAt = new Date();

      this.emitEvent('session_started', {
        sessionId: this.session.id,
        topic: this.session.topic,
        questions: questions.slice(0, 3), // 只显示前3个问题
      });
    } catch (error) {
      this.updateState('cancelled');
      throw new Error(
        `启动头脑风暴会话失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取下一个问题
   */
  getNextQuestion(): BrainstormQuestion | null {
    const unansweredQuestions = this.session.questions.filter(
      (q) => !this.session.responses.some((r) => r.questionId === q.id)
    );

    if (unansweredQuestions.length === 0) {
      return null;
    }

    // 按权重和必答优先级排序
    unansweredQuestions.sort((a, b) => {
      if (a.required !== b.required) {
        return a.required ? -1 : 1;
      }
      return b.weight - a.weight;
    });

    return unansweredQuestions[0];
  }

  /**
   * 回答问题
   */
  async answerQuestion(
    questionId: string,
    answer: string,
    confidence: number = 0.8
  ): Promise<void> {
    const question = this.session.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error(`问题不存在: ${questionId}`);
    }

    // 验证回答
    if (question.required && !answer.trim()) {
      throw new Error('必答问题不能为空');
    }

    if (question.type === 'choice' && question.choices) {
      if (!question.choices.includes(answer)) {
        throw new Error(`无效的选择: ${answer}`);
      }
    }

    // 添加回答
    const response: BrainstormResponse = {
      questionId,
      answer: answer.trim(),
      timestamp: new Date(),
      confidence,
    };

    this.session.responses.push(response);
    this.session.updatedAt = new Date();

    this.emitEvent('question_answered', {
      sessionId: this.session.id,
      questionId,
      answer: response.answer,
    });

    // 分析回答并可能生成新问题
    await this.analyzeAndGenerateFollowUp();
  }

  /**
   * 完成问答阶段，开始分析
   */
  async completeQuestioning(): Promise<void> {
    this.updateState('analyzing');

    try {
      // 生成完整分析
      const analysis = await this.aiAnalyzer.generateCompleteAnalysis(
        this.session.topic,
        this.session.responses
      );

      this.session.analysis = analysis;
      this.session.updatedAt = new Date();

      this.emitEvent('analysis_completed', {
        sessionId: this.session.id,
        analysis,
      });

      this.updateState('generating');
    } catch (error) {
      throw new Error(`分析失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成规格文档
   */
  async generateSpec(options: SpecGenerationOptions): Promise<CreateSpecRequest> {
    if (!this.session.analysis) {
      throw new Error('需要先完成分析阶段');
    }

    this.updateState('generating');

    try {
      const specContent = await this.buildSpecContent(this.session.analysis, options);

      const specRequest: CreateSpecRequest = {
        title: this.extractTitle(this.session.topic),
        description: this.extractDescription(this.session.analysis),
        content: specContent,
        tags: this.extractTags(this.session.analysis),
        projectPath: process.cwd(),
      };

      this.updateState('completed');
      this.session.completedAt = new Date();

      this.emitEvent('spec_generated', {
        sessionId: this.session.id,
        specRequest,
      });

      return specRequest;
    } catch (error) {
      throw new Error(
        `生成规格文档失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 取消会话
   */
  cancel(): void {
    this.updateState('cancelled');
    this.emitEvent('session_cancelled', {
      sessionId: this.session.id,
    });
  }

  /**
   * 获取会话进度
   */
  getProgress(): {
    totalQuestions: number;
    answeredQuestions: number;
    percentage: number;
    currentState: BrainstormSessionState;
  } {
    const totalQuestions = this.session.questions.length;
    const answeredQuestions = this.session.responses.length;
    const percentage =
      totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

    return {
      totalQuestions,
      answeredQuestions,
      percentage,
      currentState: this.session.state,
    };
  }

  // ===== 私有方法 =====

  /**
   * 更新会话状态
   */
  private updateState(state: BrainstormSessionState): void {
    this.session.state = state;
    this.session.updatedAt = new Date();
  }

  /**
   * 分析回答并生成后续问题
   */
  private async analyzeAndGenerateFollowUp(): Promise<void> {
    try {
      const analysis = await this.aiAnalyzer.analyzeResponses(this.session.responses);

      // 如果需要更多问题且置信度足够高
      if (analysis.nextQuestions.length > 0 && analysis.confidence > 0.6) {
        // 添加新问题，但限制总数
        const maxQuestions = 10;
        const currentCount = this.session.questions.length;

        if (currentCount < maxQuestions) {
          const newQuestions = analysis.nextQuestions.slice(0, maxQuestions - currentCount);
          this.session.questions.push(...newQuestions);

          this.emitEvent('new_questions_generated', {
            sessionId: this.session.id,
            questions: newQuestions,
            insights: analysis.insights,
          });
        }
      }
    } catch (error) {
      console.warn('生成后续问题失败:', error);
      // 不抛出错误，继续正常流程
    }
  }
  /**
   * 构建规格文档内容
   */
  private async buildSpecContent(
    analysis: AIAnalysis,
    options: SpecGenerationOptions
  ): Promise<string> {
    const sections: string[] = [];

    // 项目概述
    sections.push(`## 项目概述

${this.session.topic}是一个${analysis.topicAnalysis.projectType}项目，复杂度评估为${analysis.topicAnalysis.complexity}。

### 关键特性
${analysis.topicAnalysis.keywords.map((k) => `- ${k}`).join('\n')}

### 技术栈建议
${analysis.topicAnalysis.suggestedTech.map((t) => `- ${t}`).join('\n')}`);

    // 功能需求
    sections.push(`## 功能需求

### 核心功能
${analysis.functionalRequirements.core.map((f) => `- ${f}`).join('\n')}

### 扩展功能
${analysis.functionalRequirements.extended.map((f) => `- ${f}`).join('\n')}

### 可选功能
${analysis.functionalRequirements.optional.map((f) => `- ${f}`).join('\n')}`);

    // 非功能需求
    sections.push(`## 非功能需求

### 性能要求
${analysis.nonFunctionalRequirements.performance.map((p) => `- ${p}`).join('\n')}

### 安全要求
${analysis.nonFunctionalRequirements.security.map((s) => `- ${s}`).join('\n')}

### 可用性要求
${analysis.nonFunctionalRequirements.usability.map((u) => `- ${u}`).join('\n')}`);

    // 技术架构（如果包含技术细节）
    if (options.includeTechnicalDetails) {
      sections.push(`## 技术架构

### 架构模式
${analysis.technicalRecommendations.architecture}

### 技术栈
${analysis.technicalRecommendations.techStack.map((t) => `- ${t}`).join('\n')}

### 数据库选择
${analysis.technicalRecommendations.database.map((d) => `- ${d}`).join('\n')}

### 部署方案
${analysis.technicalRecommendations.deployment.map((d) => `- ${d}`).join('\n')}`);
    }

    // 风险评估（如果包含）
    if (options.includeRiskAssessment) {
      sections.push(`## 风险评估

### 技术风险
${analysis.riskAssessment.technical.map((r) => `- ${r}`).join('\n')}

### 业务风险
${analysis.riskAssessment.business.map((r) => `- ${r}`).join('\n')}

### 时间风险
${analysis.riskAssessment.timeline.map((r) => `- ${r}`).join('\n')}`);
    }

    // 实施计划（如果包含）
    if (options.includeImplementationPlan) {
      sections.push(`## 实施计划

### 阶段1：基础架构搭建
- 项目初始化
- 基础框架搭建
- 开发环境配置

### 阶段2：核心功能开发
${analysis.functionalRequirements.core.map((f) => `- ${f}`).join('\n')}

### 阶段3：扩展功能开发
${analysis.functionalRequirements.extended.map((f) => `- ${f}`).join('\n')}

### 阶段4：测试和部署
- 单元测试
- 集成测试
- 部署上线`);
    }

    // 用户回答摘要
    if (this.session.responses.length > 0) {
      sections.push(`## 需求澄清记录

基于以下问答确定的需求：

${this.session.responses
  .map((r) => {
    const question = this.session.questions.find((q) => q.id === r.questionId);
    return `**${question?.question || r.questionId}**\n${r.answer}`;
  })
  .join('\n\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * 提取标题
   */
  private extractTitle(topic: string): string {
    // 简单的标题提取逻辑
    return topic.length > 50 ? `${topic.substring(0, 47)}...` : topic;
  }

  /**
   * 提取描述
   */
  private extractDescription(analysis: AIAnalysis): string {
    const projectType = analysis.topicAnalysis.projectType;
    const complexity = analysis.topicAnalysis.complexity;
    const coreFeatures = analysis.functionalRequirements.core.slice(0, 3);

    return `${projectType}项目，复杂度：${complexity}。主要功能包括：${coreFeatures.join('、')}等。`;
  }

  /**
   * 提取标签
   */
  private extractTags(analysis: AIAnalysis): string[] {
    const tags = new Set<string>();

    // 添加项目类型标签
    tags.add(analysis.topicAnalysis.projectType.toLowerCase());

    // 添加复杂度标签
    tags.add(analysis.topicAnalysis.complexity);

    // 添加技术标签
    analysis.topicAnalysis.suggestedTech.slice(0, 3).forEach((tech) => {
      tags.add(tech.toLowerCase());
    });

    // 添加关键词标签
    analysis.topicAnalysis.keywords.slice(0, 2).forEach((keyword) => {
      tags.add(keyword.toLowerCase());
    });

    return Array.from(tags);
  }

  /**
   * 发送事件
   */
  private emitEvent(type: string, data: any): void {
    this.eventBus.emit('brainstorm_event', {
      type,
      sessionId: this.session.id,
      timestamp: new Date(),
      data,
    });
  }
}
