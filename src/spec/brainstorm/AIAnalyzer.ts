import type { ModelService } from '../../services/ModelService.js';
import type { BrainstormQuestion, BrainstormResponse, AIAnalysis } from './types.js';

/**
 * AI 分析引擎
 *
 * 职责：
 * 1. 分析项目主题
 * 2. 生成澄清问题
 * 3. 分析用户回答
 * 4. 生成需求分析
 */
export class AIAnalyzer {
  constructor(private modelService: ModelService) {}

  /**
   * 分析项目主题
   *
   * @param topic 项目主题
   * @returns AI 分析结果
   */
  async analyzeTopic(topic: string): Promise<AIAnalysis> {
    const prompt = this.buildTopicAnalysisPrompt(topic);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseAnalysisResponse(responseText);
    } catch (error) {
      console.error('AI 主题分析失败:', error);
      return this.getFallbackAnalysis(topic);
    }
  }

  /**
   * 生成澄清问题
   *
   * @param topic 项目主题
   * @param existingResponses 已有回答
   * @returns 问题列表
   */
  async generateQuestions(
    topic: string,
    existingResponses: BrainstormResponse[] = []
  ): Promise<BrainstormQuestion[]> {
    const prompt = this.buildQuestionGenerationPrompt(topic, existingResponses);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseQuestionsResponse(responseText);
    } catch (error) {
      console.error('AI 问题生成失败:', error);
      return this.getFallbackQuestions(topic);
    }
  }

  /**
   * 分析用户回答
   *
   * @param responses 用户回答列表
   * @returns 分析洞察
   */
  async analyzeResponses(responses: BrainstormResponse[]): Promise<{
    insights: string[];
    nextQuestions: BrainstormQuestion[];
    confidence: number;
  }> {
    const prompt = this.buildResponseAnalysisPrompt(responses);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseResponseAnalysis(responseText);
    } catch (error) {
      console.error('AI 回答分析失败:', error);
      return {
        insights: ['分析过程中出现错误，请重试'],
        nextQuestions: [],
        confidence: 0.3,
      };
    }
  }

  /**
   * 生成完整的需求分析
   *
   * @param topic 项目主题
   * @param responses 所有回答
   * @returns 完整分析结果
   */
  async generateCompleteAnalysis(
    topic: string,
    responses: BrainstormResponse[]
  ): Promise<AIAnalysis> {
    const prompt = this.buildCompleteAnalysisPrompt(topic, responses);

    try {
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;
      return this.parseAnalysisResponse(responseText);
    } catch (error) {
      console.error('AI 完整分析失败:', error);
      return this.getFallbackAnalysis(topic);
    }
  }

  // ===== 私有方法 =====

  /**
   * 构建主题分析提示词
   */
  private buildTopicAnalysisPrompt(topic: string): string {
    return `作为一个资深的软件架构师和产品经理，请分析以下项目主题：

项目主题：${topic}

请从以下维度进行分析，并以JSON格式返回结果：

1. 项目类型识别（Web应用、移动应用、API服务、桌面应用等）
2. 复杂度评估（low/medium/high）
3. 关键词提取（技术关键词）
4. 建议技术栈

5. 功能需求预测：
   - 核心功能（必须有的）
   - 扩展功能（应该有的）
   - 可选功能（可以有的）

6. 非功能需求：
   - 性能要求
   - 安全要求
   - 可用性要求

7. 技术建议：
   - 推荐架构模式
   - 技术栈选择
   - 数据库建议
   - 部署方案

8. 风险评估：
   - 技术风险
   - 业务风险
   - 时间风险

请确保返回有效的JSON格式，结构如下：
{
  "topicAnalysis": {
    "projectType": "string",
    "complexity": "low|medium|high",
    "keywords": ["string"],
    "suggestedTech": ["string"]
  },
  "functionalRequirements": {
    "core": ["string"],
    "extended": ["string"],
    "optional": ["string"]
  },
  "nonFunctionalRequirements": {
    "performance": ["string"],
    "security": ["string"],
    "usability": ["string"]
  },
  "technicalRecommendations": {
    "architecture": "string",
    "techStack": ["string"],
    "database": ["string"],
    "deployment": ["string"]
  },
  "riskAssessment": {
    "technical": ["string"],
    "business": ["string"],
    "timeline": ["string"]
  }
}`;
  }

  /**
   * 构建问题生成提示词
   */
  private buildQuestionGenerationPrompt(
    topic: string,
    existingResponses: BrainstormResponse[]
  ): string {
    const responsesContext =
      existingResponses.length > 0
        ? `\n已有回答：\n${existingResponses.map((r) => `Q: ${r.questionId}\nA: ${r.answer}`).join('\n\n')}`
        : '';

    return `作为一个经验丰富的需求分析师，请为以下项目主题生成3-5个澄清问题：

项目主题：${topic}${responsesContext}

请生成有助于明确需求的问题，问题应该：
1. 具体且有针对性
2. 有助于确定技术方案
3. 涵盖功能、性能、约束等方面
4. 避免与已有回答重复

请以JSON数组格式返回，每个问题包含：
- id: 问题唯一标识
- type: 问题类型（open/choice/scale/confirm）
- question: 问题内容
- description: 问题说明（可选）
- choices: 选择项（仅choice类型）
- required: 是否必答
- weight: 问题权重（1-10）
- category: 问题分类（functional/technical/business/constraints）

示例格式：
[
  {
    "id": "q1",
    "type": "choice",
    "question": "这个系统主要服务于什么类型的用户？",
    "choices": ["个人用户", "企业用户", "开发者", "管理员"],
    "required": true,
    "weight": 8,
    "category": "business"
  }
]`;
  }
  /**
   * 构建回答分析提示词
   */
  private buildResponseAnalysisPrompt(responses: BrainstormResponse[]): string {
    const responsesText = responses
      .map((r) => `问题ID: ${r.questionId}\n回答: ${r.answer}\n置信度: ${r.confidence}`)
      .join('\n\n');

    return `请分析以下用户回答，提供洞察和建议：

用户回答：
${responsesText}

请分析：
1. 从回答中获得的关键洞察
2. 是否需要更多澄清问题
3. 当前信息的完整性评估

以JSON格式返回：
{
  "insights": ["洞察1", "洞察2"],
  "nextQuestions": [问题对象数组],
  "confidence": 0.8
}`;
  }

  /**
   * 构建完整分析提示词
   */
  private buildCompleteAnalysisPrompt(topic: string, responses: BrainstormResponse[]): string {
    const responsesText = responses.map((r) => `Q: ${r.questionId}\nA: ${r.answer}`).join('\n\n');

    return `基于项目主题和用户回答，生成完整的需求分析：

项目主题：${topic}

用户回答：
${responsesText}

请生成完整的分析报告，包括：
1. 项目类型和复杂度分析
2. 详细的功能需求（核心、扩展、可选）
3. 非功能需求（性能、安全、可用性）
4. 技术建议（架构、技术栈、数据库、部署）
5. 风险评估（技术、业务、时间）

请以JSON格式返回，结构与之前的分析格式一致。`;
  }

  /**
   * 解析分析响应
   */
  private parseAnalysisResponse(response: string): AIAnalysis {
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('解析AI分析响应失败:', error);
      return this.getFallbackAnalysis('未知项目');
    }
  }

  /**
   * 解析问题响应
   */
  private parseQuestionsResponse(response: string): BrainstormQuestion[] {
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('解析AI问题响应失败:', error);
      return this.getFallbackQuestions('未知项目');
    }
  }

  /**
   * 解析回答分析响应
   */
  private parseResponseAnalysis(response: string): {
    insights: string[];
    nextQuestions: BrainstormQuestion[];
    confidence: number;
  } {
    try {
      const cleaned = this.cleanJsonResponse(response);
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('解析AI回答分析失败:', error);
      return {
        insights: ['分析过程中出现错误'],
        nextQuestions: [],
        confidence: 0.3,
      };
    }
  }

  /**
   * 清理JSON响应
   */
  private cleanJsonResponse(response: string): string {
    // 移除可能的markdown代码块标记
    let cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // 查找JSON对象的开始和结束
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }

    return cleaned.trim();
  }

  /**
   * 获取备用分析结果
   */
  private getFallbackAnalysis(topic: string): AIAnalysis {
    return {
      topicAnalysis: {
        projectType: '通用应用',
        complexity: 'medium',
        keywords: [topic],
        suggestedTech: ['JavaScript', 'Node.js', 'React'],
      },
      functionalRequirements: {
        core: ['基础功能实现'],
        extended: ['扩展功能'],
        optional: ['可选功能'],
      },
      nonFunctionalRequirements: {
        performance: ['响应时间 < 2秒'],
        security: ['基础安全防护'],
        usability: ['用户友好界面'],
      },
      technicalRecommendations: {
        architecture: 'MVC架构',
        techStack: ['JavaScript', 'Node.js'],
        database: ['PostgreSQL'],
        deployment: ['Docker', 'Cloud'],
      },
      riskAssessment: {
        technical: ['技术选型风险'],
        business: ['需求变更风险'],
        timeline: ['开发时间风险'],
      },
    };
  }

  /**
   * 获取备用问题列表
   */
  private getFallbackQuestions(topic: string): BrainstormQuestion[] {
    return [
      {
        id: 'fallback-1',
        type: 'open',
        question: `请详细描述 ${topic} 的主要功能是什么？`,
        required: true,
        weight: 10,
        category: 'functional',
      },
      {
        id: 'fallback-2',
        type: 'choice',
        question: '预期的用户规模大概是多少？',
        choices: ['< 100', '100-1000', '1000-10000', '> 10000'],
        required: true,
        weight: 8,
        category: 'business',
      },
      {
        id: 'fallback-3',
        type: 'open',
        question: '有什么特殊的技术要求或约束吗？',
        required: false,
        weight: 6,
        category: 'constraints',
      },
    ];
  }
}
