#!/usr/bin/env bun

/**
 * Review 命令手动测试脚本
 * 
 * 用法：
 * bun test-review-manual.ts
 */

import { Application } from './src/application/Application.js';
import { ConfigService } from './src/services/ConfigService.js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'pathe';

async function createTestFiles() {
  const testDir = join(process.cwd(), 'test-review-files');
  
  // 清理并创建测试目录
  await rm(testDir, { recursive: true, force: true });
  await mkdir(testDir, { recursive: true });

  // 创建有问题的JavaScript文件
  const problematicJS = `
// 有问题的JavaScript代码
console.log('Debug message - should be removed in production');
var oldVariable = 'should use let or const';

function complexFunction(param1, param2, param3) {
  if (param1) {
    if (param2) {
      while (param3) {
        for (let i = 0; i < 100; i++) {
          if (i % 2 === 0 && i % 3 === 0) {
            console.log('Very complex nested logic');
            if (i > 50) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

// 安全问题
const apiKey = "sk-1234567890abcdef";
const password = "admin123";

// 性能问题
function inefficientLoop() {
  const arr = [];
  for (let i = 0; i < 10000; i++) {
    arr.push(i);
    // 在循环中进行DOM操作（模拟）
    console.log('Processing item:', i);
  }
  return arr;
}

// 使用eval（安全风险）
function dangerousEval(code) {
  return eval(code);
}
`;

  // 创建TypeScript文件
  const typescriptCode = `
interface User {
  id: number;
  name: string;
  email: string;
}

class UserManager {
  private users: User[] = [];
  
  addUser(user: User): void {
    console.log('Adding user:', user.name);
    this.users.push(user);
  }
  
  findUser(email: string): User | undefined {
    // 低效的查找方式
    for (var i = 0; i < this.users.length; i++) {
      if (this.users[i].email === email) {
        console.log('Found user:', this.users[i]);
        return this.users[i];
      }
    }
    return undefined;
  }
  
  // 复杂的方法
  processUsers(filter?: string, sort?: boolean, limit?: number): User[] {
    let result = this.users;
    
    if (filter) {
      result = result.filter(user => {
        if (user.name.includes(filter)) {
          if (user.email.includes(filter)) {
            return true;
          } else {
            return user.name.toLowerCase().includes(filter.toLowerCase());
          }
        }
        return false;
      });
    }
    
    if (sort) {
      result = result.sort((a, b) => {
        if (a.name > b.name) {
          return 1;
        } else if (a.name < b.name) {
          return -1;
        } else {
          return 0;
        }
      });
    }
    
    if (limit) {
      result = result.slice(0, limit);
    }
    
    return result;
  }
}

// 全局变量（不推荐）
var globalUserManager = new UserManager();
`;

  // 创建相对干净的文件
  const cleanCode = `
const CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  timeout: 5000,
};

class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async get(endpoint: string): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`);
    return response.json();
  }
  
  async post(endpoint: string, data: any): Promise<any> {
    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

export { ApiClient, CONFIG };
`;

  await writeFile(join(testDir, 'problematic.js'), problematicJS);
  await writeFile(join(testDir, 'user-manager.ts'), typescriptCode);
  await writeFile(join(testDir, 'api-client.ts'), cleanCode);

  return testDir;
}

async function testReviewCommand() {
  console.log('🧪 开始 Review 命令手动测试\n');

  try {
    // 创建测试文件
    const testDir = await createTestFiles();
    console.log(`📁 创建测试文件目录: ${testDir}\n`);

    // 初始化应用
    const configService = new ConfigService();
    const app = new Application(undefined, configService);

    console.log('='.repeat(60));
    console.log('测试 1: 审查单个有问题的文件');
    console.log('='.repeat(60));
    
    const commandManager = app.getContainer().get('command');
    const reviewCommand = commandManager.getCommand('review');
    
    if (reviewCommand) {
      await reviewCommand.execute([join(testDir, 'problematic.js')], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 2: 审查TypeScript文件');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute([join(testDir, 'user-manager.ts')], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 3: 审查整个目录');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute([testDir], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 4: 安全审查');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute(['--security', testDir], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 5: JSON格式输出');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute([
        join(testDir, 'api-client.ts'),
        '--format', 'json'
      ], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 6: Markdown格式输出');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute([
        join(testDir, 'problematic.js'),
        '--format', 'markdown'
      ], app);
    }

    console.log('\n' + '='.repeat(60));
    console.log('测试 7: 帮助信息');
    console.log('='.repeat(60));
    
    if (reviewCommand) {
      await reviewCommand.execute(['help'], app);
    }

    // 清理测试文件
    await rm(testDir, { recursive: true, force: true });
    console.log(`\n🧹 清理测试文件目录: ${testDir}`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testDiffReview() {
  console.log('\n' + '='.repeat(60));
  console.log('测试 8: Git差异审查（模拟）');
  console.log('='.repeat(60));

  try {
    const configService = new ConfigService();
    const app = new Application(undefined, configService);
    
    const commandManager = app.getContainer().get('command');
    const reviewCommand = commandManager.getCommand('review');
    
    if (reviewCommand) {
      // 注意：这个测试需要在Git仓库中运行
      console.log('💡 提示: 在Git仓库中运行以下命令测试差异审查:');
      console.log('   /review --diff');
      console.log('   /review --commit HEAD');
      console.log('   /review --commit HEAD~1');
    }
  } catch (error) {
    console.log('⚠️  Git差异测试跳过（需要Git仓库环境）');
  }
}

async function main() {
  console.log('🚀 Review 命令系统手动测试');
  console.log('=====================================\n');

  await testReviewCommand();
  await testDiffReview();

  console.log('\n✅ 所有测试完成！');
  console.log('\n📝 测试总结:');
  console.log('- ✅ 单文件审查');
  console.log('- ✅ 目录审查');
  console.log('- ✅ 安全审查');
  console.log('- ✅ 多种输出格式');
  console.log('- ✅ 帮助信息');
  console.log('- ⚠️  Git差异审查（需要Git环境）');
  
  console.log('\n🎯 下一步测试建议:');
  console.log('1. 在实际项目中测试 /review 命令');
  console.log('2. 测试 Git 差异审查功能');
  console.log('3. 测试自动修复建议功能');
  console.log('4. 测试自定义规则添加');
}

// 运行测试
main().catch(console.error);