/**
 * 设计文档类型
 */
export type DesignDocumentType =
  | 'architecture' // 架构设计文档
  | 'api' // API 设计文档
  | 'database' // 数据库设计文档
  | 'ui' // UI 设计文档
  | 'testing' // 测试计划文档
  | 'complete'; // 完整技术文档

/**
 * 文档导出格式
 */
export type ExportFormat = 'markdown' | 'html' | 'pdf';

/**
 * 设计文档模板
 */
export interface DocumentTemplate {
  id: string;
  name: string;
  type: DesignDocumentType;
  description: string;
  sections: DocumentSection[];
  metadata: TemplateMetadata;
}

/**
 * 文档章节
 */
export interface DocumentSection {
  id: string;
  title: string;
  order: number;
  required: boolean;
  subsections?: DocumentSubsection[];
  contentType: 'text' | 'code' | 'diagram' | 'table' | 'list';
  aiPrompt?: string;
}

/**
 * 文档子章节
 */
export interface DocumentSubsection {
  id: string;
  title: string;
  order: number;
  contentType: 'text' | 'code' | 'diagram' | 'table' | 'list';
  aiPrompt?: string;
}

/**
 * 模板元数据
 */
export interface TemplateMetadata {
  version: string;
  author: string;
  createdAt: Date;
  updatedAt?: Date;
  tags: string[];
  estimatedGenerationTime: number; // 预计生成时间（秒）
}

/**
 * 生成的设计文档
 */
export interface DesignDocument {
  id: string;
  specId: string;
  type: DesignDocumentType;
  title: string;
  content: DocumentContent;
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 文档内容
 */
export interface DocumentContent {
  sections: GeneratedSection[];
  metadata: ContentMetadata;
}

/**
 * 生成的章节
 */
export interface GeneratedSection {
  id: string;
  title: string;
  content: string;
  subsections?: GeneratedSubsection[];
  metadata: SectionMetadata;
}

/**
 * 生成的子章节
 */
export interface GeneratedSubsection {
  id: string;
  title: string;
  content: string;
  metadata: SectionMetadata;
}

/**
 * 文档元数据
 */
export interface DocumentMetadata {
  templateId: string;
  generatedBy: 'ai' | 'manual' | 'hybrid';
  generationOptions: GenerationOptions;
  specVersion: string;
  wordCount: number;
  estimatedReadTime: number; // 预计阅读时间（分钟）
  quality?: DocumentQuality;
}

/**
 * 内容元数据
 */
export interface ContentMetadata {
  generatedAt: Date;
  analysisData: SpecDataAnalysis;
  generationStats: GenerationStats;
}

/**
 * 章节元数据
 */
export interface SectionMetadata {
  generatedAt: Date;
  aiModel?: string;
  generationTime: number; // 生成时间（毫秒）
  wordCount: number;
  quality?: number; // 质量评分 0-1
}

/**
 * 生成文档请求
 */
export interface GenerateDocumentRequest {
  type: DesignDocumentType;
  options: GenerationOptions;
}

/**
 * 生成选项
 */
export interface GenerationOptions {
  includeCodeExamples?: boolean;
  includeDiagrams?: boolean;
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
  customSections?: string[];
  language?: 'zh' | 'en';
  style?: 'formal' | 'casual' | 'technical';
}

/**
 * Spec 数据分析结果
 */
export interface SpecDataAnalysis {
  specId: string;
  brainstormData?: BrainstormAnalysis;
  planData?: PlanAnalysis;
  executionData?: ExecutionAnalysis;
  codeAnalysis?: CodeAnalysis;
  summary: AnalysisSummary;
}

/**
 * 头脑风暴分析
 */
export interface BrainstormAnalysis {
  ideas: string[];
  requirements: string[];
  constraints: string[];
  stakeholders: string[];
}

/**
 * 计划分析
 */
export interface PlanAnalysis {
  phases: string[];
  tasks: string[];
  technologies: string[];
  timeline: string;
}

/**
 * 执行分析
 */
export interface ExecutionAnalysis {
  completedTasks: string[];
  implementations: string[];
  challenges: string[];
  solutions: string[];
}

/**
 * 代码分析
 */
export interface CodeAnalysis {
  files: string[];
  functions: string[];
  classes: string[];
  apis: string[];
}

/**
 * 分析摘要
 */
export interface AnalysisSummary {
  projectType: string;
  complexity: 'low' | 'medium' | 'high';
  mainFeatures: string[];
  technicalHighlights: string[];
}

/**
 * 生成统计
 */
export interface GenerationStats {
  totalSections: number;
  generatedSections: number;
  failedSections: number;
  totalGenerationTime: number; // 毫秒
  averageQuality: number; // 0-1
}

/**
 * 文档质量
 */
export interface DocumentQuality {
  overall: number; // 0-1
  completeness: number; // 0-1
  accuracy: number; // 0-1
  readability: number; // 0-1
  technicalDepth: number; // 0-1
}

/**
 * 导出选项
 */
export interface ExportOptions {
  outputDir: string;
  filename?: string;
  includeMetadata?: boolean;
  compress?: boolean;
  customStyles?: string;
}

/**
 * 导出结果
 */
export interface ExportResult {
  format: ExportFormat;
  success: boolean;
  filepath?: string;
  filename?: string;
  size?: number;
  error?: string;
}

/**
 * 模板自定义
 */
export interface TemplateCustomization {
  name?: string;
  sections?: SectionCustomization[];
  customizedBy?: string;
}

/**
 * 章节自定义
 */
export interface SectionCustomization {
  sectionId: string;
  title?: string;
  required?: boolean;
  aiPrompt?: string;
  order?: number;
}
