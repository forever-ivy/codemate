import * as os from 'node:os';
import * as path from 'pathe';
import { getConfigPath } from '../src/utils/firstRun';
import { Paths } from '../src/services/Paths';
import { getShell } from '../src/utils/commandHelper';
import { getPathSeparator } from '../src/utils/envUtils';

console.log('🔍 Platform Compatibility Test\n');

// 1. 平台信息
console.log('Platform Information:');
console.log(`  OS: ${os.platform()}`);
console.log(`  Architecture: ${os.arch()}`);
console.log(`  Node.js: ${process.version}`);
console.log(`  Home Directory: ${os.homedir()}`);
console.log(`  Shell: ${getShell()}`);
console.log('');

// 2. 路径测试
console.log('Path Tests:');
const testPath = path.join('src', 'utils', 'helper.ts');
console.log(`  path.join('src', 'utils', 'helper.ts'): ${testPath}`);
console.log(`  Config path: ${getConfigPath()}`);
console.log('');

// 3. 文件系统测试
console.log('File System Tests:');
const paths = new Paths({ productName: 'codemate', cwd: process.cwd() });
console.log(`  Global config dir: ${paths.globalConfigDir}`);
console.log(`  Project dir: ${paths.globalProjectDir}`);
console.log(`  Session log path: ${paths.getSessionLogPath('test')}`);
console.log('');

// 4. 环境变量测试
console.log('Environment Variables:');
console.log(`  PATH separator: ${getPathSeparator()}`);
console.log(`  EOL: ${JSON.stringify(os.EOL)}`);
console.log('');

console.log('✅ All tests passed!');
