import { writeFile } from 'fs/promises';
import * as pathe from 'pathe';
import { tmpdir } from 'os';
import { LogData, Message, RequestLog } from './LogParser.js';

export class HTMLGenerator {
  async generateHTML(logData: LogData): Promise<string> {
    const html = this.buildHTML(logData);

    // 生成临时文件路径
    const timestamp = Date.now();
    const fileName = `session-log-${timestamp}.html`;
    const filePath = pathe.join(tmpdir(), fileName);

    // 写入文件
    await writeFile(filePath, html, 'utf-8');

    return filePath;
  }

  private buildHTML(logData: LogData): string {
    const { messages, requests, sessionPath, totalMessages, activeMessages } = logData;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>会话日志 - ${this.escapeHtml(pathe.basename(sessionPath))}</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>会话日志</h1>
            <div class="session-info">
                <span class="session-path">${this.escapeHtml(sessionPath)}</span>
                <span class="message-count">${activeMessages}/${totalMessages} 条消息</span>
            </div>
        </header>
        
        <div class="main">
            <div class="sidebar">
                <h2>消息列表</h2>
                <div class="message-list">
                    ${this.buildMessageList(messages)}
                </div>
            </div>
            
            <div class="content">
                <div id="message-detail" class="message-detail">
                    <div class="placeholder">
                        点击左侧消息查看详情
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        ${this.getJavaScript(messages, requests)}
    </script>
</body>
</html>`;
  }

  private buildMessageList(messages: Message[]): string {
    return messages
      .map((message, index) => {
        const roleClass = `role-${message.role}`;
        const roleText = this.getRoleText(message.role);
        const preview = this.getMessagePreview(message);
        const timestamp = new Date(message.timestamp).toLocaleTimeString();

        return `
        <div class="message-item ${roleClass}" data-index="${index}" onclick="showMessageDetail(${index})">
            <div class="message-header">
                <span class="role-badge">${roleText}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-preview">${this.escapeHtml(preview)}</div>
            <div class="message-uuid">UUID: ${this.escapeHtml(message.uuid)}</div>
            ${message.parentUuid ? `<div class="parent-uuid">Parent: ${this.escapeHtml(message.parentUuid)}</div>` : ''}
        </div>
      `;
      })
      .join('');
  }

  private getRoleText(role: string): string {
    const roleMap: Record<string, string> = {
      user: '用户',
      assistant: '助手',
      tool: '工具',
    };
    return roleMap[role] || role;
  }

  private getMessagePreview(message: Message): string {
    if (typeof message.content === 'string') {
      return message.content.slice(0, 100);
    } else if (Array.isArray(message.content)) {
      // 工具调用
      const toolCalls = message.content.filter((item) => item.type === 'tool_use');
      if (toolCalls.length > 0) {
        return `调用工具: ${toolCalls.map((call) => call.name).join(', ')}`;
      }
    }
    return '复杂内容';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private safeJsonStringify(obj: any): string {
    return JSON.stringify(obj, null, 2)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  }

  private getCSS(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
        }
        
        .container {
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: white;
            padding: 1rem 2rem;
            border-bottom: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }
        
        .session-info {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            color: #666;
        }
        
        .main {
            flex: 1;
            display: flex;
            overflow: hidden;
        }
        
        .sidebar {
            width: 400px;
            background: white;
            border-right: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
        }
        
        .sidebar h2 {
            padding: 1rem;
            border-bottom: 1px solid #e0e0e0;
            font-size: 1.1rem;
        }
        
        .message-list {
            flex: 1;
            overflow-y: auto;
        }
        
        .message-item {
            padding: 1rem;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .message-item:hover {
            background: #f8f9fa;
        }
        
        .message-item.selected {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
        }
        
        .message-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }
        
        .role-badge {
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        .role-user .role-badge {
            background: #e8f5e8;
            color: #2e7d32;
        }
        
        .role-assistant .role-badge {
            background: #e3f2fd;
            color: #1976d2;
        }
        
        .role-tool .role-badge {
            background: #fff3e0;
            color: #f57c00;
        }
        
        .timestamp {
            font-size: 0.8rem;
            color: #666;
        }
        
        .message-preview {
            font-size: 0.9rem;
            line-height: 1.4;
            margin-bottom: 0.5rem;
        }
        
        .message-uuid, .parent-uuid {
            font-size: 0.7rem;
            color: #999;
            font-family: monospace;
        }
        
        .content {
            flex: 1;
            background: white;
            overflow-y: auto;
        }
        
        .message-detail {
            padding: 2rem;
        }
        
        .placeholder {
            text-align: center;
            color: #999;
            font-style: italic;
            margin-top: 2rem;
        }
        
        .detail-section {
            margin-bottom: 2rem;
        }
        
        .detail-section h3 {
            margin-bottom: 1rem;
            color: #333;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 0.5rem;
        }
        
        .json-content {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 1rem;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        
        .tool-call {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 1rem;
            margin: 0.5rem 0;
            border-radius: 0 4px 4px 0;
        }
        
        .tool-result {
            background: #e8f5e8;
            border-left: 4px solid #4caf50;
            padding: 1rem;
            margin: 0.5rem 0;
            border-radius: 0 4px 4px 0;
        }
    `;
  }

  private getJavaScript(messages: Message[], requests: RequestLog[]): string {
    return `
        const messages = ${this.safeJsonStringify(messages)};
        const requests = ${this.safeJsonStringify(requests)};
        
        function showMessageDetail(index) {
            // 移除之前的选中状态
            document.querySelectorAll('.message-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // 添加选中状态
            const selectedItem = document.querySelector(\`[data-index="\${index}"]\`);
            selectedItem.classList.add('selected');
            
            // 显示消息详情
            const message = messages[index];
            const request = requests.find(r => r.uuid === message.uuid);
            
            const detailHtml = buildMessageDetailHTML(message, request);
            document.getElementById('message-detail').innerHTML = detailHtml;
        }
        
        function buildMessageDetailHTML(message, request) {
            let html = \`
                <div class="detail-section">
                    <h3>消息信息</h3>
                    <div class="json-content">\${JSON.stringify({
                        role: message.role,
                        uuid: message.uuid,
                        parentUuid: message.parentUuid,
                        timestamp: new Date(message.timestamp).toLocaleString()
                    }, null, 2)}</div>
                </div>
                
                <div class="detail-section">
                    <h3>消息内容</h3>
                    \${buildContentHTML(message.content)}
                </div>
            \`;
            
            if (request) {
                html += \`
                    <div class="detail-section">
                        <h3>请求信息</h3>
                        <div class="json-content">\${JSON.stringify({
                            model: request.model,
                            tools: request.tools || []
                        }, null, 2)}</div>
                    </div>
                \`;
                
                if (request.request) {
                    html += \`
                        <div class="detail-section">
                            <h3>请求详情</h3>
                            <div class="json-content">\${JSON.stringify(request.request, null, 2)}</div>
                        </div>
                    \`;
                }
                
                if (request.response) {
                    html += \`
                        <div class="detail-section">
                            <h3>响应详情</h3>
                            <div class="json-content">\${JSON.stringify(request.response, null, 2)}</div>
                        </div>
                    \`;
                }
            }
            
            return html;
        }
        
        function buildContentHTML(content) {
            if (typeof content === 'string') {
                return \`<div class="json-content">\${escapeHtml(content)}</div>\`;
            } else if (Array.isArray(content)) {
                return content.map(item => {
                    if (item.type === 'tool_use') {
                        return \`
                            <div class="tool-call">
                                <strong>工具调用: \${item.name}</strong>
                                <div class="json-content">\${JSON.stringify(item.input, null, 2)}</div>
                            </div>
                        \`;
                    } else if (item.type === 'tool_result') {
                        return \`
                            <div class="tool-result">
                                <strong>工具结果</strong>
                                <div class="json-content">\${escapeHtml(item.content || JSON.stringify(item, null, 2))}</div>
                            </div>
                        \`;
                    } else {
                        return \`<div class="json-content">\${JSON.stringify(item, null, 2)}</div>\`;
                    }
                }).join('');
            } else {
                return \`<div class="json-content">\${JSON.stringify(content, null, 2)}</div>\`;
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    `;
  }
}
