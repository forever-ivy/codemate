import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'pathe';
import type { DesignDocument, ExportFormat, ExportOptions, ExportResult } from './types.js';

/**
 * 文档导出器
 *
 * 职责：
 * 1. 导出 Markdown 格式
 * 2. 导出 HTML 格式
 * 3. 导出 PDF 格式
 * 4. 管理文件保存
 */
export class DocumentExporter {
  /**
   * 导出文档到多种格式
   */
  async exportDocument(
    document: DesignDocument,
    formats: ExportFormat[],
    options: ExportOptions
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const format of formats) {
      try {
        const result = await this.exportToFormat(document, format, options);
        results.push(result);
      } catch (error) {
        results.push({
          format,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 导出到指定格式
   */
  private async exportToFormat(
    document: DesignDocument,
    format: ExportFormat,
    options: ExportOptions
  ): Promise<ExportResult> {
    switch (format) {
      case 'markdown':
        return await this.exportToMarkdown(document, options);
      case 'html':
        return await this.exportToHTML(document, options);
      case 'pdf':
        return await this.exportToPDF(document, options);
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 Markdown
   */
  private async exportToMarkdown(
    document: DesignDocument,
    options: ExportOptions
  ): Promise<ExportResult> {
    const content = this.generateMarkdownContent(document);
    const filename = this.generateFilename(document, 'md', options);
    const filepath = this.getFilePath(filename, options);

    await this.ensureDirectoryExists(filepath);
    await writeFile(filepath, content, 'utf-8');

    return {
      format: 'markdown',
      success: true,
      filepath,
      filename,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  /**
   * 导出为 HTML
   */
  private async exportToHTML(
    document: DesignDocument,
    options: ExportOptions
  ): Promise<ExportResult> {
    const content = this.generateHTMLContent(document, options);
    const filename = this.generateFilename(document, 'html', options);
    const filepath = this.getFilePath(filename, options);

    await this.ensureDirectoryExists(filepath);
    await writeFile(filepath, content, 'utf-8');

    return {
      format: 'html',
      success: true,
      filepath,
      filename,
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  /**
   * 导出为 PDF
   */
  private async exportToPDF(
    document: DesignDocument,
    options: ExportOptions
  ): Promise<ExportResult> {
    // 注意：实际的 PDF 生成需要额外的库如 puppeteer 或 jsPDF
    // 这里提供一个简化的实现
    const htmlContent = this.generateHTMLContent(document, options);
    const pdfContent = this.convertHTMLToPDF(htmlContent);
    const filename = this.generateFilename(document, 'pdf', options);
    const filepath = this.getFilePath(filename, options);

    await this.ensureDirectoryExists(filepath);
    await writeFile(filepath, pdfContent);

    return {
      format: 'pdf',
      success: true,
      filepath,
      filename,
      size: pdfContent.length,
    };
  }

  /**
   * 生成 Markdown 内容
   */
  private generateMarkdownContent(document: DesignDocument): string {
    const lines: string[] = [];

    // 文档标题
    lines.push(`# ${document.title}`);
    lines.push('');

    // 文档元数据
    lines.push('## 文档信息');
    lines.push('');
    lines.push(`- **文档类型**: ${this.getDocumentTypeName(document.type)}`);
    lines.push(`- **生成时间**: ${document.createdAt.toLocaleString()}`);
    lines.push(`- **关联 Spec**: ${document.specId}`);
    lines.push(`- **字数统计**: ${document.metadata.wordCount} 字`);
    lines.push(`- **预计阅读时间**: ${document.metadata.estimatedReadTime} 分钟`);
    lines.push('');

    // 目录
    lines.push('## 目录');
    lines.push('');
    for (let i = 0; i < document.content.sections.length; i++) {
      const section = document.content.sections[i];
      lines.push(`${i + 1}. [${section.title}](#${this.generateAnchor(section.title)})`);
    }
    lines.push('');

    // 文档内容
    for (const section of document.content.sections) {
      lines.push(`## ${section.title}`);
      lines.push('');
      lines.push(section.content);
      lines.push('');

      // 子章节
      if (section.subsections) {
        for (const subsection of section.subsections) {
          lines.push(`### ${subsection.title}`);
          lines.push('');
          lines.push(subsection.content);
          lines.push('');
        }
      }
    }

    // 文档尾部
    lines.push('---');
    lines.push('');
    lines.push(`*本文档由 AI 自动生成于 ${document.createdAt.toLocaleString()}*`);

    return lines.join('\n');
  }

  /**
   * 生成 HTML 内容
   */
  private generateHTMLContent(document: DesignDocument, options: ExportOptions): string {
    const markdownContent = this.generateMarkdownContent(document);
    const htmlBody = this.convertMarkdownToHTML(markdownContent);

    const customStyles = options.customStyles || this.getDefaultStyles();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title}</title>
    <style>
        ${customStyles}
    </style>
</head>
<body>
    <div class="container">
        ${htmlBody}
    </div>
</body>
</html>`;
  }

  /**
   * 简化的 Markdown 到 HTML 转换
   */
  private convertMarkdownToHTML(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, '<p>$1</p>')
      .replace(/<p><h/g, '<h')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
      .replace(/<p><li>/g, '<ul><li>')
      .replace(/<\/li><\/p>/g, '</li></ul>');
  }

  /**
   * 简化的 HTML 到 PDF 转换
   */
  private convertHTMLToPDF(html: string): Buffer {
    // 实际实现需要使用 puppeteer 或其他 PDF 生成库
    // 这里返回一个占位符
    const pdfPlaceholder = `PDF 内容占位符\n生成时间: ${new Date().toISOString()}\n内容长度: ${html.length} 字符`;
    return Buffer.from(pdfPlaceholder, 'utf-8');
  }

  /**
   * 生成文件名
   */
  private generateFilename(
    document: DesignDocument,
    extension: string,
    options: ExportOptions
  ): string {
    if (options.filename) {
      return `${options.filename}.${extension}`;
    }

    const sanitizedTitle = document.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${sanitizedTitle}.${extension}`;
  }

  /**
   * 获取文件路径
   */
  private getFilePath(filename: string, options: ExportOptions): string {
    return join(options.outputDir, filename);
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(filepath: string): Promise<void> {
    const dir = dirname(filepath);
    await mkdir(dir, { recursive: true });
  }

  /**
   * 获取文档类型名称
   */
  private getDocumentTypeName(type: string): string {
    const typeNames: Record<string, string> = {
      architecture: '架构设计文档',
      api: 'API 设计文档',
      database: '数据库设计文档',
      ui: 'UI 设计文档',
      testing: '测试计划文档',
      complete: '完整技术文档',
    };

    return typeNames[type] || type;
  }

  /**
   * 生成锚点
   */
  private generateAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * 获取默认样式
   */
  private getDefaultStyles(): string {
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .container {
        background: white;
        padding: 40px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      h1, h2, h3 {
        color: #2c3e50;
        margin-top: 2em;
        margin-bottom: 1em;
      }
      
      h1 {
        border-bottom: 3px solid #3498db;
        padding-bottom: 10px;
      }
      
      h2 {
        border-bottom: 1px solid #ecf0f1;
        padding-bottom: 5px;
      }
      
      code {
        background: #f8f9fa;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }
      
      pre {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        overflow-x: auto;
      }
      
      ul, ol {
        padding-left: 2em;
      }
      
      li {
        margin-bottom: 0.5em;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }
      
      th {
        background: #f8f9fa;
        font-weight: 600;
      }
    `;
  }
}
