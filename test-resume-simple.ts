#!/usr/bin/env node

/**
 * 简单的Resume命令测试
 * 测试基本的时间格式化和会话信息结构
 */

import { TimeFormatter } from './src/utils/timeFormatter';

console.log('🧪 Testing Resume Command Components...\n');

// 测试时间格式化
console.log('📅 Testing TimeFormatter:');

const now = new Date();
const testDates = [
  new Date(now.getTime() - 30 * 1000), // 30秒前
  new Date(now.getTime() - 5 * 60 * 1000), // 5分钟前
  new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2小时前
  new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1天前
  new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1周前
];

testDates.forEach((date, index) => {
  const relative = TimeFormatter.formatRelativeTime(date);
  const absolute = TimeFormatter.formatAbsoluteTime(date);
  console.log(`  ${index + 1}. ${relative} (${absolute})`);
});

// 测试会话信息结构
console.log('\n📚 Testing Session Info Structure:');

const mockSessions = [
  {
    sessionId: 'session-001',
    modified: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    created: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    messageCount: 15,
    summary: 'Working on React components'
  },
  {
    sessionId: 'session-002',
    modified: new Date(now.getTime() - 30 * 60 * 1000),
    created: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    messageCount: 8,
    summary: 'Debugging API integration'
  },
  {
    sessionId: 'session-003',
    modified: new Date(now.getTime() - 5 * 60 * 1000),
    created: new Date(now.getTime() - 45 * 60 * 1000),
    messageCount: 3,
    summary: 'Quick code review'
  }
];

console.log('Sessions formatted for display:');
console.log('  Modified    Created     Messages Summary');
console.log('  --------    -------     -------- -------');

mockSessions.forEach(session => {
  const modified = TimeFormatter.formatRelativeTime(session.modified).padEnd(12);
  const created = TimeFormatter.formatRelativeTime(session.created).padEnd(12);
  const messages = session.messageCount.toString().padEnd(8);
  const summary = session.summary;
  
  console.log(`  ${modified}${created}${messages}${summary}`);
});

// 测试持续时间格式化
console.log('\n⏱️  Testing Duration Formatting:');

const durations = [1000, 65000, 3665000, 7265000];
durations.forEach(ms => {
  console.log(`  ${ms}ms = ${TimeFormatter.formatDuration(ms)}`);
});

console.log('\n✅ All component tests completed successfully!');
console.log('\n💡 To test the full Resume command:');
console.log('   1. Run: npm run dev');
console.log('   2. Create some test sessions by chatting');
console.log('   3. Type: /resume');
console.log('   4. Use arrow keys to navigate and Enter to select');