# Contributing to AICLI

感谢你考虑为 AICLI 做贡献！🎉

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试要求](#测试要求)
- [文档要求](#文档要求)

## 行为准则

我们致力于为每个人提供友好、安全和欢迎的环境。请阅读并遵守我们的行为准则。

## 如何贡献

### 报告 Bug

如果你发现了 bug，请：

1. 检查 [Issues](https://github.com/your-org/aicli/issues) 是否已有相同问题
2. 如果没有，创建新 Issue，包含：
   - 清晰的标题和描述
   - 重现步骤
   - 预期行为和实际行为
   - 环境信息（Node.js 版本、操作系统等）
   - 相关日志或截图

### 提出功能建议

如果你有新功能的想法：

1. 检查 [Issues](https://github.com/your-org/aicli/issues) 是否已有类似建议
2. 创建新 Issue，标记为 `enhancement`，包含：
   - 功能描述
   - 使用场景
   - 可能的实现方案
   - 是否愿意实现

### 提交代码

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 开发环境设置

### 前置要求

- Node.js 18.0.0 或更高版本
- npm 或 pnpm
- Git

### 安装步骤

```bash
# 1. Fork 并 clone 仓库
git clone https://github.com/your-username/aicli.git
cd aicli

# 2. 安装依赖
npm install

# 3. 复制环境变量文件
cp .env.example .env

# 4. 配置 API Key
# 编辑 .env 文件，添加你的 OpenAI 或 Anthropic API Key

# 5. 运行开发模式
npm run dev

# 6. 运行测试
npm test
```

## 开发流程

### 分支策略

- `main`: 稳定版本，只接受 PR
- `develop`: 开发分支
- `feature/*`: 新功能分支
- `fix/*`: Bug 修复分支
- `docs/*`: 文档更新分支

### 开发步骤

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **开发功能**
   - 编写代码
   - 添加测试
   - 更新文档

3. **运行检查**
   ```bash
   npm run ci  # 运行完整 CI 流程
   ```

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

5. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## 代码规范

### TypeScript 规范

- 使用 TypeScript 严格模式
- 所有函数和方法必须有类型注解
- 避免使用 `any`，使用 `unknown` 代替
- 使用接口定义对象类型

### 命名规范

- 类名：PascalCase (`UserService`)
- 函数/变量：camelCase (`getUserData`)
- 常量：UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- 文件名：kebab-case (`user-service.ts`)
- 工具类：以 `Tool` 结尾 (`ReadFileTool`)

### 代码风格

我们使用 Biome 进行代码格式化和 lint：

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check

# Lint
npm run lint

# 修复 lint 问题
npm run lint:fix
```

### 最佳实践

- 使用 `pathe` 而不是 `path`（跨平台兼容）
- 使用 `zod` 进行运行时类型验证
- 优先使用 async/await
- 避免回调地狱
- 保持函数简短（< 50 行）
- 单一职责原则

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 示例

```bash
feat(tools): add new file search tool

Add a new tool for searching files by content using ripgrep.
This improves search performance by 10x compared to the old implementation.

Closes #123
```

## 测试要求

### 测试类型

1. **单元测试**: 测试单个函数/类
2. **集成测试**: 测试多个组件交互
3. **端到端测试**: 测试完整流程

### 测试覆盖率

- 新代码必须有测试
- 目标覆盖率：80%+
- 关键路径必须 100% 覆盖

### 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# UI 模式
npm run test:ui

# 覆盖率报告
npm test -- --coverage
```

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';
import { MyService } from './MyService';

describe('MyService', () => {
  it('should do something', () => {
    const service = new MyService();
    const result = service.doSomething();
    expect(result).toBe('expected');
  });
});
```

## 文档要求

### 代码注释

- 所有公共 API 必须有 JSDoc 注释
- 复杂逻辑必须有解释性注释
- 避免无意义的注释

```typescript
/**
 * 读取文件内容
 * @param path - 文件路径
 * @param encoding - 文件编码，默认 utf-8
 * @returns 文件内容
 * @throws {Error} 如果文件不存在
 */
async function readFile(path: string, encoding = 'utf-8'): Promise<string> {
  // 实现...
}
```

### README 更新

如果你的更改影响用户使用：

- 更新 README.md
- 添加使用示例
- 更新功能列表

### CHANGELOG 更新

在 CHANGELOG.md 中记录你的更改：

```markdown
## [Unreleased]

### Added
- New file search tool with ripgrep support

### Fixed
- Memory leak in WebSocket server
```

## Pull Request 流程

### PR 标题

使用与提交信息相同的格式：

```
feat(tools): add file search tool
```

### PR 描述

包含以下内容：

1. **变更说明**: 做了什么改动
2. **动机**: 为什么要做这个改动
3. **测试**: 如何测试
4. **截图**: 如果有 UI 变更
5. **相关 Issue**: `Closes #123`

### PR 检查清单

- [ ] 代码遵循项目规范
- [ ] 添加了测试
- [ ] 测试全部通过
- [ ] 更新了文档
- [ ] 更新了 CHANGELOG
- [ ] CI 检查通过

### Code Review

- 所有 PR 需要至少一个 reviewer 批准
- 解决所有 review 意见
- CI 必须通过
- 没有冲突

## 获取帮助

如果你有任何问题：

- 查看 [文档](./docs/)
- 搜索 [Issues](https://github.com/your-org/aicli/issues)
- 在 [Discussions](https://github.com/your-org/aicli/discussions) 提问
- 发送邮件到 support@your-org.com

## 许可证

通过贡献代码，你同意你的贡献将在 MIT 许可证下发布。

---

感谢你的贡献！🙏
