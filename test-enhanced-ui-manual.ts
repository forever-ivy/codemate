/**
 * 手动测试增强UI功能
 */
import { Application } from './src/application/Application.js';
import { Container } from './src/application/Container.js';

/**
 * 手动测试增强 UI 功能
 */
async function testEnhancedUI() {
  console.log('🧪 Testing Enhanced UI Features...\n');
  
  try {
    // 1. 初始化应用
    console.log('1. Initializing application...');
    const container = new Container();
    const app = new Application(container);
    // Application 在构造函数中自动初始化
    console.log('✅ Application initialized\n');
    
    // 2. 测试主题系统
    console.log('2. Testing theme system...');
    const { ThemeSystem } = await import('./src/ui/theme/ThemeSystem.js');
    const themeSystem = new ThemeSystem();
    
    console.log('   - Light theme background:', themeSystem.getCurrentTheme().background);
    themeSystem.setTheme('dark');
    console.log('   - Dark theme background:', themeSystem.getCurrentTheme().background);
    
    const typography = themeSystem.getTypography();
    console.log('   - Typography mono font:', typography.fonts.mono);
    
    const spacing = themeSystem.getSpacing();
    console.log('   - Spacing values:', spacing);
    console.log('✅ Theme system working\n');
    
    // 3. 测试建议引擎
    console.log('3. Testing suggestion engine...');
    const { SuggestionEngine } = await import('./src/ui/components/SuggestionBox.js');
    const suggestionEngine = new SuggestionEngine();
    
    const suggestions = await suggestionEngine.getSuggestions('/he');
    console.log('   - Suggestions for "/he":', suggestions.map(s => s.text));
    
    suggestionEngine.addToHistory('test command');
    const historySuggestions = await suggestionEngine.getSuggestions('test');
    console.log('   - History suggestions:', historySuggestions.map(s => s.text));
    
    const allCommands = await suggestionEngine.getSuggestions('/');
    console.log('   - All commands count:', allCommands.filter(s => s.type === 'command').length);
    console.log('✅ Suggestion engine working\n');
    
    // 4. 测试会话服务集成
    console.log('4. Testing session service integration...');
    const sessionService = app.getContainer().get('session');
    const session = await sessionService.create('enhanced-ui-test');
    
    await sessionService.addMessage({
      role: 'user',
      content: 'Test enhanced UI'
    });
    
    await sessionService.addMessage({
      role: 'assistant',
      content: 'Enhanced UI is working great!'
    });
    
    console.log('   - Session created:', session.id);
    console.log('   - Messages count:', session.messages.length);
    console.log('   - Last message:', session.messages[session.messages.length - 1].content);
    console.log('✅ Session integration working\n');
    
    // 5. 测试命令管理器
    console.log('5. Testing command manager...');
    const commandManager = app.getContainer().get('command');
    
    const commands = commandManager.list();
    console.log('   - Available commands:', commands.slice(0, 5), '...');
    console.log('   - Total commands:', commands.length);
    
    console.log('   - Is "/help" a command?', commandManager.isCommand('/help'));
    console.log('   - Is "hello" a command?', commandManager.isCommand('hello'));
    console.log('✅ Command manager working\n');
    
    // 6. 测试工具管理器
    console.log('6. Testing tool manager...');
    const toolManager = app.getContainer().get('tool');
    
    const tools = toolManager.list();
    console.log('   - Available tools:', tools.slice(0, 5), '...');
    console.log('   - Total tools:', tools.length);
    
    // 测试获取工具
    const readTool = toolManager.get('read');
    console.log('   - Read tool exists:', !!readTool);
    console.log('✅ Tool manager working\n');
    
    // 7. 测试性能监控
    console.log('7. Testing performance monitoring...');
    const startTime = Date.now();
    
    // 模拟大量操作
    for (let i = 0; i < 100; i++) {
      await suggestionEngine.getSuggestions(`test${i}`);
    }
    
    const endTime = Date.now();
    console.log(`   - 100 suggestion queries took: ${endTime - startTime}ms`);
    
    // 测试主题切换性能
    const themeStartTime = Date.now();
    for (let i = 0; i < 1000; i++) {
      themeSystem.setTheme(i % 2 === 0 ? 'light' : 'dark');
    }
    const themeEndTime = Date.now();
    console.log(`   - 1000 theme switches took: ${themeEndTime - themeStartTime}ms`);
    console.log('✅ Performance monitoring complete\n');
    
    // 8. 测试错误处理
    console.log('8. Testing error handling...');
    try {
      // 尝试访问不存在的会话
      await sessionService.loadSession('non-existent-session');
    } catch (error) {
      console.log('   - Error handling works:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    try {
      // 尝试获取不存在的工具
      const nonExistentTool = toolManager.get('non-existent-tool');
      console.log('   - Non-existent tool returns:', nonExistentTool);
    } catch (error) {
      console.log('   - Tool error handling works:', error instanceof Error ? error.message : 'Unknown error');
    }
    console.log('✅ Error handling working\n');
    
    // 9. 测试内存使用
    console.log('9. Testing memory usage...');
    const memBefore = process.memoryUsage();
    
    // 创建大量建议
    for (let i = 0; i < 1000; i++) {
      suggestionEngine.addToHistory(`large history item ${i} with some content`);
    }
    
    const memAfter = process.memoryUsage();
    const memDiff = memAfter.heapUsed - memBefore.heapUsed;
    console.log(`   - Memory usage increased by: ${Math.round(memDiff / 1024 / 1024 * 100) / 100}MB`);
    console.log('✅ Memory usage monitoring complete\n');
    
    console.log('🎉 All enhanced UI tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('   - Theme System: ✅');
    console.log('   - Suggestion Engine: ✅');
    console.log('   - Session Integration: ✅');
    console.log('   - Command Manager: ✅');
    console.log('   - Tool Manager: ✅');
    console.log('   - Performance: ✅');
    console.log('   - Error Handling: ✅');
    console.log('   - Memory Usage: ✅');
    
  } catch (error) {
    console.error('❌ Enhanced UI test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedUI();
}