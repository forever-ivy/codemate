/**
 * 测试 edit_code 工具
 */
import { EditCodeTool } from './src/tools/code/EditCodeTool';

async function test() {
  console.log('🧪 Testing EditCodeTool...\n');

  const tool = new EditCodeTool();

  // 测试修改 add 函数
  const result = await tool.execute({
    path: 'src/utils/math.ts',
    target: 'add',
    targetType: 'function',
    newCode: `export function add(a: number, b: number, c: number = 0): number {
  return a + b + c;
}`,
  });

  console.log('\n📊 Result:', result);

  if (result.success) {
    console.log('\n✅ Test passed!');
    console.log('Old code:', result.oldCode);
    console.log('New code:', result.newCode);
  } else {
    console.log('\n❌ Test failed:', result.message);
  }
}

test().catch(console.error);
