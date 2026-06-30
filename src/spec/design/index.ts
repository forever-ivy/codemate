/**
 * Spec Design Document System
 *
 * 导出设计文档系统的所有核心组件
 */

// 核心类型
export type * from './types.js';

// 核心组件
export { DesignDocumentGenerator } from './DesignDocumentGenerator.js';
export { DocumentTemplateManager } from './DocumentTemplateManager.js';
export { DocumentExporter } from './DocumentExporter.js';

// 模板
export { completeTemplate } from './templates/complete.js';
export { architectureTemplate } from './templates/architecture.js';
export { apiTemplate } from './templates/api.js';
export { databaseTemplate } from './templates/database.js';
export { uiTemplate } from './templates/ui.js';
export { testingTemplate } from './templates/testing.js';
