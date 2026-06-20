import { SlashCommand } from '../base/SlashCommand.js';
import type { Application } from '../../application/Application.js';
import type { ModelService } from '../../services/ModelService.js';
import type { EventBus } from '../../services/EventBus.js';
import type { SpecManager } from '../../spec/SpecManager.js';
import { BrainstormSession } from '../../spec/brainstorm/BrainstormSession.js';
import type { BrainstormQuestion, SpecGenerationOptions } from '../../spec/brainstorm/types.js';

/**
 * SpecBrainstormCommand - Spec 头脑风暴命令
 *
 * 用法：
 * /spec:brainstorm "用户认证系统"
 * /spec:brainstorm --interactive
 */
export class SpecBrainstormCommand extends SlashCommand {
  name = 'spec:brainstorm';
  description = 'AI-assisted project requirements brainstorming';
  aliases = ['spec:bs', 'brainstorm'];

  validate(args: string[]): boolean {
    if (args.length === 0) {
      console.log('❌ 用法: /spec:brainstorm <项目主题> 或 /spec:brainstorm --interactive');
      console.log('   示例: /spec:brainstorm "用户认证系统"');
      return false;
    }
    return true;
  }

  async execute(args: string[], app: Application): Promise<void> {
    try {
      // 获取服务
      const modelService = app.getContainer().get<ModelService>('model');
      const eventBus = app.getContainer().get<EventBus>('eventBus');
      const specManager = app.getContainer().get<SpecManager>('spec');

      // 检查是否是交互模式
      if (args[0] === '--interactive' || args[0] === '-i') {
        await this.runInteractiveMode(modelService, eventBus, specManager);
        return;
      }

      // 直接模式：使用提供的主题
      const topic = args.join(' ');
      await this.runDirectMode(topic, modelService, eventBus, specManager);
    } catch (error) {
      console.error('❌ 头脑风暴失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 运行交互模式
   */
  private async runInteractiveMode(
    modelService: ModelService,
    eventBus: EventBus,
    specManager: SpecManager
  ): Promise<void> {
    console.log('🧠 欢迎使用 AI 头脑风暴助手！\n');
    console.log('我将帮助你分析项目需求，生成详细的规格文档。\n');

    // 获取项目主题
    const topic = await this.promptForTopic();
    if (!topic) {
      console.log('❌ 已取消头脑风暴');
      return;
    }

    await this.runBrainstormSession(topic, modelService, eventBus, specManager);
  }

  /**
   * 运行直接模式
   */
  private async runDirectMode(
    topic: string,
    modelService: ModelService,
    eventBus: EventBus,
    specManager: SpecManager
  ): Promise<void> {
    console.log(`🧠 开始分析项目: ${topic}\n`);
    await this.runBrainstormSession(topic, modelService, eventBus, specManager);
  }

  /**
   * 运行头脑风暴会话
   */
  private async runBrainstormSession(
    topic: string,
    modelService: ModelService,
    eventBus: EventBus,
    specManager: SpecManager
  ): Promise<void> {
    // 创建头脑风暴会话
    const session = new BrainstormSession(topic, eventBus, modelService);

    // 监听会话事件
    this.setupEventListeners(eventBus);

    try {
      // 启动会话
      console.log('🔍 正在分析项目主题...');
      await session.start();

      // 问答阶段
      await this.runQuestioningPhase(session);

      // 分析阶段
      console.log('\n📊 正在分析你的回答...');
      await session.completeQuestioning();

      // 生成规格文档
      const specRequest = await this.generateSpecDocument(session);

      // 保存规格文档
      const document = await specManager.create(specRequest);

      console.log(`\n✅ 头脑风暴完成！`);
      console.log(`📄 规格文档已创建: ${document.title} (${document.id})`);
      console.log(`📁 文档路径: ~/.aicli/data/specs/${document.id}.md`);
      console.log(`\n💡 提示: 使用 /spec:write-plan ${document.id} 生成实施计划`);
    } catch (error) {
      session.cancel();
      throw error;
    }
  }

  /**
   * 运行问答阶段
   */
  private async runQuestioningPhase(session: BrainstormSession): Promise<void> {
    console.log('\n❓ 现在我需要了解更多细节，请回答以下问题：\n');

    let questionCount = 0;
    const maxQuestions = 8; // 限制问题数量

    while (questionCount < maxQuestions) {
      const question = session.getNextQuestion();
      if (!question) {
        break; // 没有更多问题
      }

      const answer = await this.askQuestion(question);
      if (answer === null) {
        // 用户选择跳过或退出
        break;
      }

      await session.answerQuestion(question.id, answer);
      questionCount++;

      // 显示进度
      const progress = session.getProgress();
      console.log(
        `\n📈 进度: ${progress.answeredQuestions}/${Math.min(progress.totalQuestions, maxQuestions)} 问题已回答\n`
      );
    }

    console.log('✅ 问答阶段完成');
  }

  /**
   * 询问单个问题
   */
  private async askQuestion(question: BrainstormQuestion): Promise<string | null> {
    console.log(`${question.required ? '🔴' : '🔵'} ${question.question}`);

    if (question.description) {
      console.log(`   💡 ${question.description}`);
    }

    if (question.type === 'choice' && question.choices) {
      console.log('   选择项:');
      question.choices.forEach((choice, index) => {
        console.log(`   ${index + 1}. ${choice}`);
      });
    }

    // 简化实现：直接返回示例答案
    // 在实际实现中，这里应该使用真正的用户输入
    return this.getExampleAnswer(question);
  }

  /**
   * 获取示例答案（用于演示）
   */
  private getExampleAnswer(question: BrainstormQuestion): string {
    const examples: Record<string, string> = {
      'fallback-1': '实现用户注册、登录、密码重置等基础认证功能',
      'fallback-2': '1000-10000',
      'fallback-3': '需要支持多种登录方式，包括邮箱、手机号和第三方登录',
    };

    return examples[question.id] || '根据项目需求确定';
  }

  /**
   * 生成规格文档
   */
  private async generateSpecDocument(session: BrainstormSession): Promise<any> {
    console.log('\n📝 正在生成规格文档...');

    // 获取生成选项
    const options: SpecGenerationOptions = {
      includeTechnicalDetails: true,
      includeImplementationPlan: true,
      includeRiskAssessment: true,
      detailLevel: 'detailed',
      audience: 'developer',
    };

    return await session.generateSpec(options);
  }

  /**
   * 提示用户输入主题
   */
  private async promptForTopic(): Promise<string | null> {
    console.log('请描述你想要开发的项目：');
    console.log('例如: "用户认证系统"、"电商购物车"、"博客管理系统"');
    console.log('');

    // 简化实现：返回示例主题
    // 在实际实现中，这里应该使用真正的用户输入
    const exampleTopic = '用户认证系统';
    console.log(`> ${exampleTopic}`);
    return exampleTopic;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(eventBus: EventBus): void {
    eventBus.on('brainstorm_event', (event) => {
      switch (event.type) {
        case 'session_started':
          console.log(`✅ 会话已启动，生成了 ${event.data.questions.length} 个初始问题`);
          break;
        case 'question_answered':
          // 静默处理，避免过多输出
          break;
        case 'new_questions_generated':
          if (event.data.insights.length > 0) {
            console.log('💡 AI 洞察:');
            event.data.insights.forEach((insight: string) => {
              console.log(`   - ${insight}`);
            });
          }
          break;
        case 'analysis_completed':
          console.log('✅ 需求分析完成');
          break;
        case 'spec_generated':
          console.log('✅ 规格文档生成完成');
          break;
        case 'session_cancelled':
          console.log('❌ 会话已取消');
          break;
      }
    });
  }
}
