/**
 * 测试 CodeLocator
 */
import { CodeParser } from './src/code/CodeParser';
import { CodeLocator } from './src/code/CodeLocator';
import * as fs from 'node:fs/promises';

async function test() {
  console.log('🧪 Testing CodeLocator...\n');

  const parser = new CodeParser();
  const locator = new CodeLocator();

  // 读取文件
  const code = await fs.readFile('src/utils/math.ts', 'utf-8');
  console.log('📄 File content:');
  console.log(code);
  console.log();

  // 解析
  const ast = parser.parse(code, 'src/utils/math.ts');

  // 查找 add 函数
  const element = locator.find(ast, 'add', 'function');

  console.log('🔍 Found element:');
  console.log('Name:', element?.name);
  console.log('Type:', element?.type);
  console.log('Location:', element?.location);
  console.log('Code:', element?.code);
}

test().catch(console.error);
