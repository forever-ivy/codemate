# CodeMate AI - Enterprise AI Coding Assistant 🤖

> Your AI pair programmer in the terminal

[![npm version](https://img.shields.io/npm/v/@laf-fe/codemate-cli.svg)](https://www.npmjs.com/package/@laf-fe/codemate-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@laf-fe/codemate-cli.svg)](https://nodejs.org)

CodeMate AI is an enterprise-grade AI coding assistant that brings the power of large language models directly to your terminal. Built with TypeScript and powered by OpenAI, Anthropic, and DeepSeek, it transforms natural language into working code.

## ✨ Features

- 🚀 **Natural Language to Code** - Describe what you want, get working code
- 🔧 **Intelligent Code Editing** - AST-based code modifications with context awareness
- 🧪 **AI-Powered Testing** - Automatic test generation and validation
- 📊 **Performance Optimization** - Prompt caching, context compression, intelligent pruning
- 🌐 **HTTP Server Mode** - Browser-based UI with WebSocket support
- 🔌 **MCP Protocol Support** - Extensible tool system via Model Context Protocol
- 🌍 **Multiple AI Providers** - OpenAI, Anthropic, DeepSeek, OpenRouter, and custom APIs
- 🎨 **Multiple Output Styles** - Customizable output formatting and themes
- 💾 **Session Management** - Resume conversations and track file changes
- 🔄 **Multi-Agent System** - Specialized agents for different tasks
- 🎯 **Slash Commands** - Quick actions with `/help`, `/clear`, `/sessions`, etc.

## 📦 Installation

```bash
npm install -g @laf-fe/codemate-cli
```

**Requirements:**
- Node.js 18.0.0 or higher
- OpenAI, Anthropic, or DeepSeek API key

## 🚀 Quick Start

### First Run

On first run, CodeMate AI will guide you through interactive setup:

```bash
$ codemate

欢迎使用 CodeMate AI! 🎉

检测到这是首次运行，需要进行初始配置。

请选择 AI 提供商:
  1. OpenAI (GPT-4, GPT-3.5)
  2. Anthropic (Claude)
  3. DeepSeek (国内可用，性价比高)
  4. OpenRouter (多模型聚合)
  5. 自定义 (OpenAI 兼容 API)

请输入选项 (1-5): 3

请输入 API Key: sk-...

请输入模型名称 (直接回车使用默认: deepseek-chat): 

✅ 配置已保存到: ~/.aiclirc.json

提供商: DeepSeek
模型: deepseek-chat
Base URL: https://api.deepseek.com

配置完成！现在可以开始使用了。

试试：codemate "创建一个 Hello World 程序"
```

### 基础使用

```bash
# 启动交互式模式
codemate

# 在交互界面中输入你的需求
> 创建一个 Express API 服务器
```

**注意**：当前版本仅支持交互式模式。一次性命令模式（如 `codemate "prompt"`）将在未来版本中支持。

## 📖 Usage Examples

### Create a New Project

```bash
codemate "create a React app with TypeScript and Tailwind CSS"
```

### Refactor Code

```bash
codemate "refactor the UserService class to use dependency injection"
```

### Generate Tests

```bash
codemate "write unit tests for the authentication module"
```

### Debug Issues

```bash
codemate "fix the memory leak in the WebSocket server"
```

## ⚙️ Configuration

Configuration file: `~/.aiclirc.json`

### Supported AI Providers

| Provider | Features | Best For |
|----------|----------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | International users, best ecosystem |
| **Anthropic** | Claude series | Long context, high safety |
| **DeepSeek** | 国内可用 | China users, cost-effective |
| **OpenRouter** | Multi-model | Access multiple models |
| **Custom** | OpenAI-compatible | Self-hosted, special needs |

### Configuration Examples

**OpenAI:**
```json
{
  "provider": "openai",
  "apiKey": "sk-...",
  "model": "gpt-4",
  "performance": {
    "enableCaching": true,
    "enableCompression": true
  }
}
```

**DeepSeek:**
```json
{
  "provider": "deepseek",
  "apiKey": "sk-...",
  "model": "deepseek-chat",
  "baseURL": "https://api.deepseek.com",
  "performance": {
    "enableCaching": true,
    "enableCompression": true
  }
}
```

**Custom API:**
```json
{
  "provider": "custom",
  "apiKey": "your-key",
  "model": "your-model",
  "baseURL": "https://api.example.com/v1",
  "performance": {
    "enableCaching": true,
    "enableCompression": true
  }
}
```

### Supported Models

**OpenAI:**
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

**Anthropic:**
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`

**DeepSeek:**
- `deepseek-chat`
- `deepseek-coder`

**OpenRouter:**
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4`
- And many more...

## 🎮 Commands

### Slash Commands

- `/help` - Show available commands
- `/clear` - Clear current session
- `/sessions` - List all sessions
- `/model` - Change AI model
- `/style` - Change output style
- `/snapshots` - View file history
- `/rewind` - Revert file changes
- `/exit` - Exit AICLI

### CLI Options

```bash
codemate [options] [prompt]

Options:
  -v, --version              Output version number
  -h, --help                 Display help
  -s, --server               Start HTTP server mode
  -p, --port <port>          Server port (default: 3000)
  -m, --model <model>        AI model to use
  --no-cache                 Disable prompt caching
  --no-compression           Disable context compression
```

## 🏗️ Architecture

CodeMate AI is built with a modular architecture:

- **Application Layer** - Dependency injection and lifecycle management
- **Service Layer** - Core services (Model, Config, Session, EventBus)
- **Manager Layer** - Tool, Plugin, Agent, Command managers
- **Tool System** - File operations, search, bash execution, code editing
- **Agent System** - General, Plan, and Explore agents
- **UI Layer** - Ink-based terminal UI with React components
- **Server Layer** - HTTP server with WebSocket for browser UI

## 🔌 Extensibility

### Custom Plugins

Create custom plugins in `~/.codemate/plugins/`:

```typescript
import { Plugin } from '@laf-fe/codemate-cli';

export class MyPlugin extends Plugin {
  name = 'my-plugin';
  
  async onInit() {
    console.log('Plugin initialized');
  }
  
  async onToolCall(tool: string, args: any) {
    // Custom logic
  }
}
```


## 🧪 Development

```bash
# Clone repository
git clone https://github.com/your-org/codemate-ai.git
cd codemate-ai

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Format code
npm run format

# Run full CI
npm run ci

# Build for production
npm run build

# Test local installation
npm run test:install
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📝 License

MIT © [Your Name](https://github.com/your-org)

## 🙏 Acknowledgments

- Built with [AI SDK](https://sdk.vercel.ai)
- UI powered by [Ink](https://github.com/vadimdemedes/ink)

## 📮 Support

- 🐛 [Report Issues](https://github.com/your-org/codemate-ai/issues)
- 💬 [Discussions](https://github.com/your-org/codemate-ai/discussions)
- 📧 Email: support@codemate-ai.com

---

**Made with ❤️ by developers, for developers**
