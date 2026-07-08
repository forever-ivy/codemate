import { LogCommand } from './src/commands/log/LogCommand.js';
import { Container } from './src/application/Container.js';
import { SessionService } from './src/services/SessionService.js';
import { Paths } from './src/services/Paths.js';
import { EventBus } from './src/services/EventBus.js';
import { writeFile, mkdir } from 'fs/promises';
import * as pathe from 'pathe';

async function createTestSession() {
  console.log('🔧 创建测试会话数据...');
  
  const paths = new Paths({
    productName: 'aicli',
    cwd: process.cwd(),
  });
  const sessionsDir = paths.globalProjectDir; // 使用 globalProjectDir 而不是 getSessionsDir()
  
  // 确保会话目录存在
  await mkdir(sessionsDir, { recursive: true });
  
  // 创建测试会话
  const sessionId = `test-session-${Date.now()}`;
  const sessionFile = pathe.join(sessionsDir, `${sessionId}.jsonl`);
  const requestFile = pathe.join(sessionsDir, `${sessionId}.requests.jsonl`);
  
  // 创建测试消息
  const messages = [
    {
      role: 'user',
      content: '请帮我列出当前目录的文件',
      uuid: 'msg-1',
      timestamp: Date.now() - 5000
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'list_files',
          input: { path: '.' }
        }
      ],
      uuid: 'msg-2',
      parentUuid: 'msg-1',
      timestamp: Date.now() - 4000
    },
    {
      role: 'tool',
      content: 'package.json\nsrc/\ntests/\nREADME.md',
      uuid: 'msg-3',
      parentUuid: 'msg-2',
      timestamp: Date.now() - 3000
    },
    {
      role: 'assistant',
      content: '我看到当前目录包含以下文件和文件夹：\n\n- package.json - 项目配置文件\n- src/ - 源代码目录\n- tests/ - 测试文件目录\n- README.md - 项目说明文档',
      uuid: 'msg-4',
      parentUuid: 'msg-3',
      timestamp: Date.now() - 2000
    },
    {
      role: 'user',
      content: '能详细说明一下 src 目录的结构吗？',
      uuid: 'msg-5',
      parentUuid: 'msg-4',
      timestamp: Date.now() - 1000
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-2',
          name: 'list_files',
          input: { path: 'src', recursive: true }
        }
      ],
      uuid: 'msg-6',
      parentUuid: 'msg-5',
      timestamp: Date.now()
    }
  ];
  
  // 创建测试请求日志
  const requests = [
    {
      uuid: 'msg-2',
      model: 'deepseek-chat',
      tools: ['list_files', 'read_file', 'write_file'],
      request: {
        messages: [
          { role: 'user', content: '请帮我列出当前目录的文件' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: { type: 'string' }
                }
              }
            }
          }
        ]
      },
      response: {
        id: 'resp-1',
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'tool-1',
                  type: 'function',
                  function: {
                    name: 'list_files',
                    arguments: '{"path":"."}'
                  }
                }
              ]
            }
          }
        ]
      },
      chunks: []
    },
    {
      uuid: 'msg-6',
      model: 'deepseek-chat',
      tools: ['list_files', 'read_file', 'write_file'],
      request: {
        messages: [
          { role: 'user', content: '能详细说明一下 src 目录的结构吗？' }
        ]
      },
      response: {
        id: 'resp-2',
        model: 'deepseek-chat',
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'tool-2',
                  type: 'function',
                  function: {
                    name: 'list_files',
                    arguments: '{"path":"src","recursive":true}'
                  }
                }
              ]
            }
          }
        ]
      },
      chunks: []
    }
  ];
  
  // 写入文件
  const sessionJsonl = messages.map(msg => JSON.stringify(msg)).join('\n');
  const requestJsonl = requests.map(req => JSON.stringify(req)).join('\n');
  
  await writeFile(sessionFile, sessionJsonl);
  await writeFile(requestFile, requestJsonl);
  
  console.log(`✅ 测试会话已创建: ${sessionFile}`);
  return sessionFile;
}

async function testLogCommand() {
  console.log('🧪 测试日志查看命令...');
  
  // 创建容器和依赖
  const container = new Container();
  const paths = new Paths({
    productName: 'aicli',
    cwd: process.cwd(),
  });
  const eventBus = new EventBus();
  const sessionService = new SessionService(paths, eventBus);
  
  container.register('paths', paths);
  container.register('eventBus', eventBus);
  container.register('session', sessionService);
  
  // 创建命令实例
  const logCommand = new LogCommand(container);
  
  // 创建测试会话
  const sessionFile = await createTestSession();
  
  console.log('\n📋 测试场景：');
  console.log('1. 直接打开会话文件');
  console.log('2. 交互式会话选择（需要手动测试）');
  
  try {
    // 测试直接文件路径
    console.log('\n🔍 测试直接文件路径...');
    await logCommand.execute([sessionFile]);
    
    console.log('✅ 直接文件路径测试完成');
    
    // 交互式测试需要手动运行
    console.log('\n📝 手动测试步骤：');
    console.log('1. 运行: npm run dev');
    console.log('2. 输入: /log');
    console.log('3. 使用 ↑↓ 键选择会话');
    console.log('4. 按 Enter 确认选择');
    console.log('5. 检查浏览器是否打开 HTML 日志');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

async function testLogParser() {
  console.log('🔍 测试日志解析器...');
  
  const { LogParser } = await import('./src/commands/log/LogParser.js');
  const parser = new LogParser();
  
  // 创建测试会话
  const sessionFile = await createTestSession();
  
  try {
    const logData = await parser.parseLogFile(sessionFile);
    
    console.log('📊 解析结果:');
    console.log(`- 总消息数: ${logData.totalMessages}`);
    console.log(`- 活跃消息数: ${logData.activeMessages}`);
    console.log(`- 请求日志数: ${logData.requests.length}`);
    
    console.log('\n📝 活跃消息列表:');
    logData.messages.forEach((msg, index) => {
      const content = typeof msg.content === 'string' 
        ? msg.content.slice(0, 50) + '...'
        : `[工具调用: ${msg.content.length} 个]`;
      console.log(`${index + 1}. [${msg.role}] ${content}`);
    });
    
    console.log('✅ 日志解析测试完成');
    
  } catch (error) {
    console.error('❌ 日志解析测试失败:', error.message);
  }
}

async function testHTMLGenerator() {
  console.log('🎨 测试 HTML 生成器...');
  
  const { HTMLGenerator } = await import('./src/commands/log/HTMLGenerator.js');
  const { LogParser } = await import('./src/commands/log/LogParser.js');
  
  const generator = new HTMLGenerator();
  const parser = new LogParser();
  
  // 创建测试会话
  const sessionFile = await createTestSession();
  
  try {
    // 解析日志
    const logData = await parser.parseLogFile(sessionFile);
    
    // 生成 HTML
    const htmlPath = await generator.generateHTML(logData);
    
    console.log(`✅ HTML 文件已生成: ${htmlPath}`);
    
    // 检查文件内容
    const { readFile } = await import('fs/promises');
    const htmlContent = await readFile(htmlPath, 'utf-8');
    
    console.log('📋 HTML 文件检查:');
    console.log(`- 文件大小: ${htmlContent.length} 字符`);
    console.log(`- 包含 DOCTYPE: ${htmlContent.includes('<!DOCTYPE html>')}`);
    console.log(`- 包含消息列表: ${htmlContent.includes('message-list')}`);
    console.log(`- 包含 JavaScript: ${htmlContent.includes('showMessageDetail')}`);
    
    console.log('✅ HTML 生成测试完成');
    
  } catch (error) {
    console.error('❌ HTML 生成测试失败:', error.message);
  }
}

async function main() {
  console.log('🚀 开始日志查看系统测试\n');
  
  try {
    await testLogParser();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testHTMLGenerator();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testLogCommand();
    
    console.log('\n🎉 所有测试完成！');
    
  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}