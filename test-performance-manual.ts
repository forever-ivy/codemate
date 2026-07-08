/**
 * 性能优化手动测试脚本
 *
 * 测试：
 * 1. Token 计数
 * 2. 剪枝服务
 * 3. 压缩服务
 * 4. 性能监控
 */

import { countTokens, countMessageTokens, countTotalTokens } from './src/utils/tokenCounter';
import { PruningService } from './src/optimization/PruningService';
import { PerformanceMonitor } from './src/optimization/PerformanceMonitor';
import type { CompressionConfig } from './src/optimization/types';

console.log('🧪 性能优化手动测试\n');

// ============ 测试 1: Token 计数 ============
console.log('📊 测试 1: Token 计数');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const text1 = 'Hello, world!';
const tokens1 = countTokens(text1);
console.log(`文本: "${text1}"`);
console.log(`Token 数: ${tokens1}\n`);

const text2 = '这是一段中文文本，用于测试 Token 计数功能。';
const tokens2 = countTokens(text2);
console.log(`文本: "${text2}"`);
console.log(`Token 数: ${tokens2}\n`);

// ============ 测试 2: 消息 Token 计数 ============
console.log('📊 测试 2: 消息 Token 计数');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const message1 = {
  role: 'user',
  content: 'Hello, how are you?',
};
const messageTokens1 = countMessageTokens(message1);
console.log(`消息: ${JSON.stringify(message1)}`);
console.log(`Token 数: ${messageTokens1}\n`);

const message2 = {
  role: 'assistant',
  content: [
    { type: 'text', text: 'I am doing well, thank you!' },
  ],
};
const messageTokens2 = countMessageTokens(message2);
console.log(`消息: ${JSON.stringify(message2)}`);
console.log(`Token 数: ${messageTokens2}\n`);

// ============ 测试 3: 总 Token 计数 ============
console.log('📊 测试 3: 总 Token 计数');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const messages = [
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'How are you?' },
  { role: 'assistant', content: 'I am doing well, thank you!' },
];
const totalTokens = countTotalTokens(messages);
console.log(`消息数: ${messages.length}`);
console.log(`总 Token 数: ${totalTokens}\n`);

// ============ 测试 4: 剪枝服务 ============
console.log('📊 测试 4: 剪枝服务');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const pruningService = new PruningService();

const config: CompressionConfig = {
  compaction: {
    auto: true,
    outputTokenMax: 8192,
    autoContinue: true,
    triggerRatio: 0.7,
  },
  pruning: {
    enabled: true,
    protectThreshold: 100, // 低阈值，方便测试
    minimumPrune: 10,
    protectedTools: ['read_file'],
    protectTurns: 1,
  },
};

const messagesWithTools = [
  { role: 'user', content: 'List files' },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolName: 'list_files',
        result: {
          llmContent: 'file1.ts\nfile2.ts\nfile3.ts\n' + 'x'.repeat(200),
        },
      },
    ],
  },
  { role: 'user', content: 'Read file' },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolName: 'read_file',
        result: {
          llmContent: 'const x = 1;\nconst y = 2;\n' + 'y'.repeat(200),
        },
      },
    ],
  },
  { role: 'user', content: 'Write file' },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolName: 'write_file',
        result: {
          llmContent: 'File written successfully\n' + 'z'.repeat(200),
        },
      },
    ],
  },
];

console.log(`原始消息数: ${messagesWithTools.length}`);
console.log(`原始 Token 数: ${countTotalTokens(messagesWithTools)}\n`);

const pruneResult = pruningService.prune(messagesWithTools, config);

console.log(`剪枝结果:`);
console.log(`  - 是否剪枝: ${pruneResult.pruned}`);
console.log(`  - 剪枝数量: ${pruneResult.prunedCount}`);
console.log(`  - 剪枝 Token: ${pruneResult.prunedTokens}`);
console.log(`剪枝后 Token 数: ${countTotalTokens(messagesWithTools)}\n`);

// ============ 测试 5: 性能监控 ============
console.log('📊 测试 5: 性能监控');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const monitor = new PerformanceMonitor();

// 模拟几次请求
monitor.recordRequest({
  inputTokens: 1000,
  outputTokens: 500,
  cacheReadTokens: 800,
  cacheWriteTokens: 200,
  responseTime: 1500,
});

monitor.recordRequest({
  inputTokens: 1200,
  outputTokens: 600,
  cacheReadTokens: 1000,
  cacheWriteTokens: 0,
  responseTime: 1200,
});

monitor.recordRequest({
  inputTokens: 800,
  outputTokens: 400,
  cacheReadTokens: 700,
  cacheWriteTokens: 0,
  responseTime: 1000,
});

// 记录优化
monitor.recordOptimization({
  pruned: true,
  prunedTokens: 500,
  compacted: false,
});

monitor.recordOptimization({
  pruned: false,
  compacted: true,
  compactedTokens: 2000,
});

// 生成报告
const report = monitor.generateReport();
console.log(report);

console.log('\n✅ 所有测试完成！');
