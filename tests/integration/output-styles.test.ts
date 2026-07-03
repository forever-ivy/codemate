import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'pathe';
import { Container } from '../../src/application/Container';
import { Paths } from '../../src/services/Paths';
import { ModelService, type ModelServiceConfig } from '../../src/services/ModelService';
import type { OutputStyle } from '../../src/styles/base/OutputStyle';

describe('OutputStyle Integration', () => {
  let tempDir: string;
  let container: Container;
  let paths: Paths;

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(process.cwd(), '.test-integration-styles');
    fs.mkdirSync(tempDir, { recursive: true });

    // 创建 Container 和 Paths
    container = new Container();
    paths = new Paths({
      productName: 'aicli',
      cwd: tempDir,
    });

    // 注册 Paths 服务
    container.register('paths', paths);
  });

  afterEach(() => {
    // 清理
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should integrate with ModelService', () => {
    // 创建 ModelService
    const modelServiceConfig: ModelServiceConfig = {
      apiKey: 'test-key',
      baseURL: 'https://test.com',
      model: 'test-model',
      container,
      paths,
    };
    const modelService = new ModelService(modelServiceConfig);

    // 设置样式
    modelService.setOutputStyle('Concise');

    // 获取样式
    const style = modelService.getOutputStyle();
    expect(style.name).toBe('Concise');
  });

  it('should use default style when not set', () => {
    // 创建 ModelService
    const modelServiceConfig: ModelServiceConfig = {
      apiKey: 'test-key',
      baseURL: 'https://test.com',
      model: 'test-model',
      container,
      paths,
    };
    const modelService = new ModelService(modelServiceConfig);

    const style = modelService.getOutputStyle();
    expect(style.name).toBe('Default');
  });

  it('should list all styles', () => {
    // 创建 ModelService
    const modelServiceConfig: ModelServiceConfig = {
      apiKey: 'test-key',
      baseURL: 'https://test.com',
      model: 'test-model',
      container,
      paths,
    };
    const modelService = new ModelService(modelServiceConfig);

    const styles = modelService.listOutputStyles();
    expect(styles.length).toBeGreaterThan(0);
  });

  it('should load custom style from project', () => {
    // 创建项目样式目录
    const stylesDir = path.join(tempDir, '.aicli', 'output-styles');
    fs.mkdirSync(stylesDir, { recursive: true });

    // 创建自定义样式
    const styleFile = path.join(stylesDir, 'project-style.md');
    fs.writeFileSync(
      styleFile,
      '---\ndescription: Project style\nisCodingRelated: true\n---\n\nProject prompt'
    );

    // 重新创建 Container 和 Paths 以加载新样式
    const newContainer = new Container();
    const newPaths = new Paths({
      productName: 'aicli',
      cwd: tempDir,
    });
    newContainer.register('paths', newPaths);

    // 创建 ModelService
    const modelServiceConfig: ModelServiceConfig = {
      apiKey: 'test-key',
      baseURL: 'https://test.com',
      model: 'test-model',
      container: newContainer,
      paths: newPaths,
    };
    const modelService = new ModelService(modelServiceConfig);
    const styles = modelService.listOutputStyles();

    const projectStyle = styles.find((s: OutputStyle) => s.name === 'project-style');
    expect(projectStyle).toBeDefined();
    expect(projectStyle?.description).toContain('Project style');
  });
});
