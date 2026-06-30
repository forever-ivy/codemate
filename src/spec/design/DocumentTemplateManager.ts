import type {
  DocumentTemplate,
  DesignDocumentType,
  TemplateCustomization,
  DocumentSection,
  SectionCustomization,
} from './types.js';
import { completeTemplate } from './templates/complete.js';
import { architectureTemplate } from './templates/architecture.js';
import { apiTemplate } from './templates/api.js';
import { databaseTemplate } from './templates/database.js';
import { uiTemplate } from './templates/ui.js';
import { testingTemplate } from './templates/testing.js';

/**
 * 文档模板管理器
 *
 * 职责：
 * 1. 管理文档模板
 * 2. 提供模板选择
 * 3. 支持模板自定义
 * 4. 验证模板格式
 */
export class DocumentTemplateManager {
  private templates = new Map<DesignDocumentType, DocumentTemplate>();

  constructor() {
    this.initializeBuiltinTemplates();
  }

  /**
   * 获取模板
   */
  async getTemplate(type: DesignDocumentType): Promise<DocumentTemplate> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`模板不存在: ${type}`);
    }
    return template;
  }

  /**
   * 列出所有模板
   */
  listTemplates(): DocumentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 验证模板
   */
  validateTemplate(template: DocumentTemplate): boolean {
    try {
      // 基本字段验证
      if (!template.id || !template.name || !template.type) {
        return false;
      }

      // 章节验证
      if (!template.sections || template.sections.length === 0) {
        return false;
      }

      // 章节结构验证
      for (const section of template.sections) {
        if (!section.id || !section.title || typeof section.order !== 'number') {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 自定义模板
   */
  customizeTemplate(
    type: DesignDocumentType,
    customization: TemplateCustomization
  ): DocumentTemplate {
    const baseTemplate = this.templates.get(type);
    if (!baseTemplate) {
      throw new Error(`基础模板不存在: ${type}`);
    }

    const customizedTemplate: DocumentTemplate = {
      ...baseTemplate,
      id: `${baseTemplate.id}_custom_${Date.now()}`,
      name: customization.name || `${baseTemplate.name} (自定义)`,
      sections: this.applySectionCustomization(baseTemplate.sections, customization.sections || []),
      metadata: {
        ...baseTemplate.metadata,
        updatedAt: new Date(),
      },
    };

    // 验证自定义模板
    if (!this.validateTemplate(customizedTemplate)) {
      throw new Error('自定义模板验证失败');
    }

    return customizedTemplate;
  }

  /**
   * 注册自定义模板
   */
  registerTemplate(template: DocumentTemplate): void {
    if (!this.validateTemplate(template)) {
      throw new Error('模板验证失败');
    }

    this.templates.set(template.type, template);
  }

  /**
   * 获取模板统计信息
   */
  getTemplateStats(type: DesignDocumentType): {
    sectionCount: number;
    estimatedTime: number;
    complexity: 'low' | 'medium' | 'high';
  } {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`模板不存在: ${type}`);
    }

    const sectionCount = template.sections.length;
    const estimatedTime = template.metadata.estimatedGenerationTime;

    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (sectionCount > 10) complexity = 'high';
    else if (sectionCount > 5) complexity = 'medium';

    return {
      sectionCount,
      estimatedTime,
      complexity,
    };
  }

  /**
   * 初始化内置模板
   */
  private initializeBuiltinTemplates(): void {
    this.templates.set('complete', completeTemplate);
    this.templates.set('architecture', architectureTemplate);
    this.templates.set('api', apiTemplate);
    this.templates.set('database', databaseTemplate);
    this.templates.set('ui', uiTemplate);
    this.templates.set('testing', testingTemplate);
  }

  /**
   * 应用章节自定义
   */
  private applySectionCustomization(
    baseSections: DocumentSection[],
    customizations: SectionCustomization[]
  ): DocumentSection[] {
    const customizedSections = [...baseSections];

    for (const customization of customizations) {
      const sectionIndex = customizedSections.findIndex(
        (section) => section.id === customization.sectionId
      );

      if (sectionIndex !== -1) {
        const section = customizedSections[sectionIndex];
        customizedSections[sectionIndex] = {
          ...section,
          title: customization.title || section.title,
          required: customization.required ?? section.required,
          aiPrompt: customization.aiPrompt || section.aiPrompt,
          order: customization.order ?? section.order,
        };
      }
    }

    // 按 order 排序
    return customizedSections.sort((a, b) => a.order - b.order);
  }

  /**
   * 获取模板预览
   */
  getTemplatePreview(type: DesignDocumentType): {
    name: string;
    description: string;
    sections: string[];
    estimatedTime: number;
  } {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`模板不存在: ${type}`);
    }

    return {
      name: template.name,
      description: template.description,
      sections: template.sections.map((section) => section.title),
      estimatedTime: template.metadata.estimatedGenerationTime,
    };
  }
}
