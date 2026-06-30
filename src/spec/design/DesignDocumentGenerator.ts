import { nanoid } from 'nanoid';
import type { EventBus } from '../../services/EventBus.js';
import type { ModelService } from '../../services/ModelService.js';
import type { SpecDocument } from '../types.js';
import type {
  DesignDocument,
  DesignDocumentType,
  DocumentTemplate,
  GenerateDocumentRequest,
  SpecDataAnalysis,
  DocumentContent,
  GeneratedSection,
  DocumentSection,
  GenerationStats,
} from './types.js';
import { DocumentTemplateManager } from './DocumentTemplateManager.js';

/**
 * 设计文档生成器
 *
 * 职责：
 * 1. 分析 Spec 数据
 * 2. 应用文档模板
 * 3. 生成文档内容
 * 4. 管理文档版本
 */
export class DesignDocumentGenerator {
  private templateManager: DocumentTemplateManager;

  constructor(
    private eventBus: EventBus,
    private modelService: ModelService
  ) {
    this.templateManager = new DocumentTemplateManager();
  }

  /**
   * 生成设计文档
   */
  async generate(spec: SpecDocument, request: GenerateDocumentRequest): Promise<DesignDocument> {
    try {
      // 1. 分析 Spec 数据
      this.emitEvent('document_generation_started', {
        specId: spec.id,
        type: request.type,
      });

      const analysis = await this.analyzeSpecData(spec);

      // 2. 获取文档模板
      const template = await this.templateManager.getTemplate(request.type);

      // 3. 生成文档内容
      const content = await this.generateDocumentContent(analysis, template, request);

      // 4. 创建文档对象
      const document: DesignDocument = {
        id: nanoid(),
        specId: spec.id,
        type: request.type,
        title: this.generateDocumentTitle(spec, request.type),
        content,
        metadata: {
          templateId: template.id,
          generatedBy: 'ai',
          generationOptions: request.options,
          specVersion: spec.version || '1.0.0',
          wordCount: this.calculateWordCount(content),
          estimatedReadTime: this.calculateReadTime(content),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.emitEvent('document_generation_completed', {
        documentId: document.id,
        specId: spec.id,
        type: request.type,
        wordCount: document.metadata.wordCount,
      });

      return document;
    } catch (error) {
      this.emitEvent('document_generation_failed', {
        specId: spec.id,
        type: request.type,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * 分析 Spec 数据
   */
  private async analyzeSpecData(spec: SpecDocument): Promise<SpecDataAnalysis> {
    try {
      const prompt = this.buildAnalysisPrompt(spec);
      const response = await this.modelService.chat(prompt);
      const responseText = typeof response === 'string' ? response : response.content;

      return this.parseAnalysisResult(responseText, spec);
    } catch (error) {
      console.error('分析 Spec 数据失败:', error);
      return this.getFallbackAnalysis(spec);
    }
  }

  /**
   * 生成文档内容
   */
  private async generateDocumentContent(
    analysis: SpecDataAnalysis,
    template: DocumentTemplate,
    request: GenerateDocumentRequest
  ): Promise<DocumentContent> {
    const startTime = Date.now();
    const sections: GeneratedSection[] = [];
    let generatedSections = 0;
    let failedSections = 0;

    // 按模板章节生成内容
    for (const section of template.sections) {
      try {
        const sectionContent = await this.generateSectionContent(
          section,
          analysis,
          request.options
        );

        sections.push(sectionContent);
        generatedSections++;
      } catch (error) {
        console.error(`生成章节失败: ${section.title}`, error);
        failedSections++;

        // 添加错误占位符
        sections.push({
          id: section.id,
          title: section.title,
          content: `*[生成失败: ${error instanceof Error ? error.message : String(error)}]*`,
          metadata: {
            generatedAt: new Date(),
            generationTime: 0,
            wordCount: 0,
            quality: 0,
          },
        });
      }
    }

    const totalGenerationTime = Date.now() - startTime;
    const averageQuality =
      sections.reduce((sum, s) => sum + (s.metadata.quality || 0), 0) / sections.length;

    const generationStats: GenerationStats = {
      totalSections: template.sections.length,
      generatedSections,
      failedSections,
      totalGenerationTime,
      averageQuality,
    };

    return {
      sections,
      metadata: {
        generatedAt: new Date(),
        analysisData: analysis,
        generationStats,
      },
    };
  }

  /**
   * 生成章节内容
   */
  private async generateSectionContent(
    section: DocumentSection,
    analysis: SpecDataAnalysis,
    options: any
  ): Promise<GeneratedSection> {
    const startTime = Date.now();

    try {
      const prompt = this.buildSectionPrompt(section, analysis, options);
      const response = await this.modelService.chat(prompt);
      const content = typeof response === 'string' ? response : response.content;

      const generationTime = Date.now() - startTime;
      const wordCount = this.countWords(content);

      return {
        id: section.id,
        title: section.title,
        content: content.trim(),
        metadata: {
          generatedAt: new Date(),
          generationTime,
          wordCount,
          quality: this.assessContentQuality(content),
        },
      };
    } catch (error) {
      throw new Error(`章节生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(spec: SpecDocument): string {
    return `请分析以下 Spec 文档数据，提取关键信息用于生成设计文档：

Spec 标题: ${spec.title}
Spec 描述: ${spec.description}
Spec 状态: ${spec.status}

任务列表:
${spec.tasks.map((task) => `- ${task.title}: ${task.description} (${task.status})`).join('\n')}

请从以下角度分析：
1. 项目类型和复杂度
2. 主要功能特性
3. 技术要求和约束
4. 实现重点和难点

请以 JSON 格式返回分析结果。`;
  }

  /**
   * 构建章节提示词
   */
  private buildSectionPrompt(
    section: DocumentSection,
    analysis: SpecDataAnalysis,
    options: any
  ): string {
    const basePrompt = section.aiPrompt || `请为 "${section.title}" 章节生成内容`;

    return `${basePrompt}

项目信息:
- 项目类型: ${analysis.summary.projectType}
- 复杂度: ${analysis.summary.complexity}
- 主要特性: ${analysis.summary.mainFeatures.join(', ')}

生成要求:
- 内容类型: ${section.contentType}
- 详细程度: ${options.detailLevel || 'detailed'}
- 语言: ${options.language || 'zh'}
- 风格: ${options.style || 'technical'}

请生成专业、详细的技术文档内容。`;
  }

  /**
   * 解析分析结果
   */
  private parseAnalysisResult(responseText: string, spec: SpecDocument): SpecDataAnalysis {
    try {
      const parsed = JSON.parse(responseText);
      return {
        specId: spec.id,
        summary: {
          projectType: parsed.projectType || 'Web Application',
          complexity: parsed.complexity || 'medium',
          mainFeatures: parsed.mainFeatures || [],
          technicalHighlights: parsed.technicalHighlights || [],
        },
      };
    } catch (error) {
      return this.getFallbackAnalysis(spec);
    }
  }

  /**
   * 获取备用分析结果
   */
  private getFallbackAnalysis(spec: SpecDocument): SpecDataAnalysis {
    return {
      specId: spec.id,
      summary: {
        projectType: 'Software Project',
        complexity: 'medium',
        mainFeatures: spec.tasks.map((task) => task.title),
        technicalHighlights: ['基于现代技术栈', '模块化设计', '可扩展架构'],
      },
    };
  }

  /**
   * 生成文档标题
   */
  private generateDocumentTitle(spec: SpecDocument, type: DesignDocumentType): string {
    const typeNames = {
      architecture: '架构设计文档',
      api: 'API 设计文档',
      database: '数据库设计文档',
      ui: 'UI 设计文档',
      testing: '测试计划文档',
      complete: '技术设计文档',
    };

    return `${spec.title} - ${typeNames[type]}`;
  }

  /**
   * 计算字数
   */
  private calculateWordCount(content: DocumentContent): number {
    return content.sections.reduce((total, section) => {
      return total + this.countWords(section.content);
    }, 0);
  }

  /**
   * 计算阅读时间
   */
  private calculateReadTime(content: DocumentContent): number {
    const wordCount = this.calculateWordCount(content);
    // 假设中文阅读速度为 300 字/分钟
    return Math.ceil(wordCount / 300);
  }

  /**
   * 统计单词数
   */
  private countWords(text: string): number {
    // 简单的中英文字数统计
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 评估内容质量
   */
  private assessContentQuality(content: string): number {
    // 简单的质量评估算法
    const wordCount = this.countWords(content);
    const hasStructure = content.includes('#') || content.includes('-') || content.includes('1.');
    const hasDetails = wordCount > 100;

    let quality = 0.5; // 基础分数
    if (hasStructure) quality += 0.2;
    if (hasDetails) quality += 0.2;
    if (wordCount > 300) quality += 0.1;

    return Math.min(quality, 1.0);
  }

  /**
   * 发送事件
   */
  private emitEvent(eventName: string, data: any): void {
    this.eventBus.emit(eventName, data);
  }
}
