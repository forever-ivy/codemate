/**
 * 头脑风暴问题类型
 */
export type QuestionType =
  | 'open' // 开放性问题
  | 'choice' // 选择题
  | 'scale' // 评分题
  | 'confirm'; // 确认题

/**
 * 头脑风暴问题
 */
export interface BrainstormQuestion {
  /** 问题ID */
  id: string;
  /** 问题类型 */
  type: QuestionType;
  /** 问题内容 */
  question: string;
  /** 问题描述 */
  description?: string;
  /** 选择项（仅用于选择题） */
  choices?: string[];
  /** 是否必答 */
  required: boolean;
  /** 问题权重 */
  weight: number;
  /** 问题分类 */
  category: 'functional' | 'technical' | 'business' | 'constraints';
}

/**
 * 用户回答
 */
export interface BrainstormResponse {
  /** 问题ID */
  questionId: string;
  /** 回答内容 */
  answer: string;
  /** 回答时间 */
  timestamp: Date;
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * AI 分析结果
 */
export interface AIAnalysis {
  /** 主题分析 */
  topicAnalysis: {
    /** 项目类型 */
    projectType: string;
    /** 复杂度评估 */
    complexity: 'low' | 'medium' | 'high';
    /** 关键词提取 */
    keywords: string[];
    /** 相关技术栈 */
    suggestedTech: string[];
  };
  /** 功能需求 */
  functionalRequirements: {
    /** 核心功能 */
    core: string[];
    /** 扩展功能 */
    extended: string[];
    /** 可选功能 */
    optional: string[];
  };
  /** 非功能需求 */
  nonFunctionalRequirements: {
    /** 性能要求 */
    performance: string[];
    /** 安全要求 */
    security: string[];
    /** 可用性要求 */
    usability: string[];
  };
  /** 技术建议 */
  technicalRecommendations: {
    /** 架构模式 */
    architecture: string;
    /** 技术栈 */
    techStack: string[];
    /** 数据库选择 */
    database: string[];
    /** 部署方案 */
    deployment: string[];
  };
  /** 风险评估 */
  riskAssessment: {
    /** 技术风险 */
    technical: string[];
    /** 业务风险 */
    business: string[];
    /** 时间风险 */
    timeline: string[];
  };
}

/**
 * 头脑风暴会话状态
 */
export type BrainstormSessionState =
  | 'initializing' // 初始化中
  | 'questioning' // 问答阶段
  | 'analyzing' // 分析阶段
  | 'generating' // 生成阶段
  | 'completed' // 完成
  | 'cancelled'; // 取消

/**
 * 头脑风暴会话
 */
export interface BrainstormSession {
  /** 会话ID */
  id: string;
  /** 主题 */
  topic: string;
  /** 会话状态 */
  state: BrainstormSessionState;
  /** 问题列表 */
  questions: BrainstormQuestion[];
  /** 回答列表 */
  responses: BrainstormResponse[];
  /** AI 分析结果 */
  analysis?: AIAnalysis;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 完成时间 */
  completedAt?: Date;
}

/**
 * 规格生成选项
 */
export interface SpecGenerationOptions {
  /** 包含技术细节 */
  includeTechnicalDetails: boolean;
  /** 包含实施计划 */
  includeImplementationPlan: boolean;
  /** 包含风险评估 */
  includeRiskAssessment: boolean;
  /** 详细程度 */
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  /** 目标受众 */
  audience: 'developer' | 'manager' | 'stakeholder';
}
