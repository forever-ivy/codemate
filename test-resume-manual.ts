import { Application } from './src/application/Application';
import { Container } from './src/application/Container';
import { ResumeCommand } from './src/commands/session/ResumeCommand';
import { SessionService } from './src/services/SessionService';

async function testResumeCommand() {
  console.log('🧪 Testing Resume Command...\n');
  
  try {
    // 1. 初始化应用
    const container = new Container();
    const app = new Application(container);
    const resumeCommand = new ResumeCommand();
    
    console.log('✅ Application initialized');
    
    // 2. 创建测试会话
    const sessionService = app.getContainer().get<SessionService>('session');
    
    // 创建第一个测试会话
    await sessionService.create('test-session-1');
    await sessionService.addMessage({
      role: 'user',
      content: 'Hello, this is test session 1'
    });
    await sessionService.addMessage({
      role: 'assistant',
      content: 'Hi! This is the response from session 1'
    });
    
    // 创建第二个测试会话
    await sessionService.create('test-session-2');
    await sessionService.addMessage({
      role: 'user',
      content: 'This is test session 2'
    });
    await sessionService.addMessage({
      role: 'assistant',
      content: 'Response from session 2'
    });
    
    // 创建第三个测试会话
    await sessionService.create('test-session-3');
    await sessionService.addMessage({
      role: 'user',
      content: 'Another test session'
    });
    
    console.log('✅ Test sessions created');
    
    // 3. 测试会话列表
    const sessions = sessionService.list();
    console.log(`✅ Found ${sessions.length} sessions:`);
    
    sessions.forEach(session => {
      console.log(`   - ${session.sessionId}: ${session.messageCount} messages`);
      console.log(`     Summary: ${session.summary || 'No summary'}`);
      console.log(`     Modified: ${session.modified.toLocaleString()}`);
    });
    
    // 4. 测试Resume命令
    console.log('\n🎯 Testing Resume Command...');
    console.log('Note: This will show the interactive resume selector');
    console.log('Use arrow keys to navigate, Enter to select, ESC to cancel\n');
    
    // 执行resume命令（这会显示交互式界面）
    await resumeCommand.execute([], app);
    
    console.log('\n✅ Resume command test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// 运行测试
testResumeCommand();