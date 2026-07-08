import { Container } from './src/application/Container';
import { Paths } from './src/services/Paths';
import { ModelService, type ModelServiceConfig } from './src/services/ModelService';

async function main() {
  console.log('=== Output Style System Manual Test ===\n');

  // 创建 Container 和 Paths
  const container = new Container();
  const paths = new Paths({
    productName: 'aicli',
    cwd: process.cwd(),
  });
  
  // 注册 Paths 服务
  container.register('paths', paths);

  // 创建 ModelService
  const modelServiceConfig: ModelServiceConfig = {
    apiKey: 'test-key',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    container,
    paths,
  };
  const modelService = new ModelService(modelServiceConfig);

  // 1. 列出所有样式
  console.log('1. Available output styles:');
  const styles = modelService.listOutputStyles();
  for (const style of styles) {
    const marker = style.isDefault() ? '(default)' : '';
    console.log(`   - ${style.name}: ${style.description} ${marker}`);
  }
  console.log();

  // 2. 测试默认样式
  console.log('2. Testing default style:');
  const defaultStyle = modelService.getOutputStyle();
  console.log(`   Name: ${defaultStyle.name}`);
  console.log(`   Description: ${defaultStyle.description}`);
  console.log(`   Prompt: ${defaultStyle.prompt.substring(0, 50)}...`);
  console.log();

  // 3. 测试切换样式
  console.log('3. Testing style switching:');
  modelService.setOutputStyle('Concise');
  const conciseStyle = modelService.getOutputStyle();
  console.log(`   Current style: ${conciseStyle.name}`);
  console.log(`   Description: ${conciseStyle.description}`);
  console.log();

  // 4. 测试 JSON 样式
  console.log('4. Testing JSON style:');
  const jsonStyle = JSON.stringify({
    name: 'Test JSON',
    description: 'From JSON',
    isCodingRelated: true,
    prompt: 'This is a test prompt from JSON',
  });
  modelService.setOutputStyle(jsonStyle);
  const customStyle = modelService.getOutputStyle();
  console.log(`   Name: ${customStyle.name}`);
  console.log(`   Description: ${customStyle.description}`);
  console.log();

  // 5. 测试编程相关样式
  console.log('5. Coding-related styles:');
  const outputStyleManager = container.getOutputStyleManager();
  const codingStyles = outputStyleManager.listCodingRelated();
  console.log(`   Found ${codingStyles.length} coding-related styles`);
  for (const style of codingStyles) {
    console.log(`   - ${style.name}`);
  }

  console.log('\n✅ All manual tests completed!');
}

main().catch(console.error);
