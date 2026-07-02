// WebSocket 连接
let ws = null;
let currentSessionId = null;

// DOM 元素
const messageList = document.getElementById('message-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const sessionList = document.getElementById('session-list');
const newSessionBtn = document.getElementById('new-session-btn');

/**
 * 初始化应用
 */
async function init() {
  // 连接 WebSocket
  connectWebSocket();
  
  // 加载会话列表
  await loadSessions();
  
  // 绑定事件
  bindEvents();
}

/**
 * 连接 WebSocket
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleWebSocketMessage(message);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    // 5 秒后重连
    setTimeout(connectWebSocket, 5000);
  };
}

/**
 * 处理 WebSocket 消息
 */
function handleWebSocketMessage(message) {
  const { type, role, content, tool, args, result } = message;
  
  switch (type) {
    case 'connected':
      console.log('Connected to server');
      break;
      
    case 'message':
      if (role === 'user') {
        addMessage('user', content);
      } else if (role === 'assistant') {
        addMessage('assistant', content);
      }
      break;
      
    case 'chunk':
      // 流式更新最后一条消息
      updateLastMessage(content);
      break;
      
    case 'tool_call':
      addToolMessage(`🛠️ 调用工具: ${tool}`, args);
      break;
      
    case 'tool_result':
      addToolMessage(`✅ 工具结果: ${tool}`, result);
      break;
      
    case 'done':
      enableInput();
      break;
      
    case 'error':
      addMessage('error', message.error);
      enableInput();
      break;
  }
}

/**
 * 加载会话列表
 */
async function loadSessions() {
  try {
    const response = await fetch('/api/sessions');
    const data = await response.json();
    
    if (data.success) {
      renderSessions(data.data);
      
      // 如果有会话，加载第一个
      if (data.data.length > 0) {
        await loadSession(data.data[0].sessionId);
      }
    }
  } catch (error) {
    console.error('Failed to load sessions:', error);
  }
}

/**
 * 渲染会话列表
 */
function renderSessions(sessions) {
  sessionList.innerHTML = '';
  
  for (const session of sessions) {
    const item = document.createElement('div');
    item.className = 'session-item';
    if (session.sessionId === currentSessionId) {
      item.classList.add('active');
    }
    
    item.innerHTML = `
      <div class="session-item-title">${session.summary || '新会话'}</div>
      <div class="session-item-meta">${session.messageCount} 条消息</div>
    `;
    
    item.onclick = () => loadSession(session.sessionId);
    
    sessionList.appendChild(item);
  }
}

/**
 * 加载会话
 */
async function loadSession(sessionId) {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await response.json();
    
    if (data.success) {
      currentSessionId = sessionId;
      renderMessages(data.data);
      
      // 更新会话列表高亮
      document.querySelectorAll('.session-item').forEach(item => {
        item.classList.remove('active');
      });
      event.target.closest('.session-item')?.classList.add('active');
    }
  } catch (error) {
    console.error('Failed to load session:', error);
  }
}

/**
 * 渲染消息列表
 */
function renderMessages(messages) {
  messageList.innerHTML = '';
  
  for (const message of messages) {
    addMessage(message.role, message.content, false);
  }
  
  scrollToBottom();
}

/**
 * 添加消息
 */
function addMessage(role, content, scroll = true) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${role}`;
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-role">${getRoleName(role)}</span>
      <span class="message-time">${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="message-content">${formatContent(content)}</div>
  `;
  
  messageList.appendChild(messageDiv);
  
  if (scroll) {
    scrollToBottom();
  }
}

/**
 * 添加工具消息
 */
function addToolMessage(title, data) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message message-tool';
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="message-role">${title}</span>
    </div>
    <div class="message-content">
      <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>
  `;
  
  messageList.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * 更新最后一条消息（流式）
 */
function updateLastMessage(chunk) {
  const messages = messageList.querySelectorAll('.message-assistant');
  let lastMessage = messages[messages.length - 1];
  
  if (!lastMessage) {
    addMessage('assistant', chunk);
    return;
  }
  
  const content = lastMessage.querySelector('.message-content');
  content.textContent += chunk;
  
  scrollToBottom();
}

/**
 * 发送消息
 */
function sendMessage() {
  const content = messageInput.value.trim();
  
  if (!content) return;
  
  if (!currentSessionId) {
    alert('请先创建或选择一个会话');
    return;
  }
  
  // 发送到 WebSocket
  ws.send(JSON.stringify({
    type: 'message',
    sessionId: currentSessionId,
    content,
  }));
  
  // 清空输入框
  messageInput.value = '';
  
  // 禁用输入
  disableInput();
}

/**
 * 创建新会话
 */
async function createSession() {
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: '新会话',
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadSessions();
      await loadSession(data.data.sessionId);
    }
  } catch (error) {
    console.error('Failed to create session:', error);
  }
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 发送按钮
  sendBtn.onclick = sendMessage;
  
  // 输入框回车发送
  messageInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // 新建会话按钮
  newSessionBtn.onclick = createSession;
}

/**
 * 禁用输入
 */
function disableInput() {
  messageInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="loading"></div>';
}

/**
 * 启用输入
 */
function enableInput() {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  sendBtn.textContent = '发送';
  messageInput.focus();
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
  messageList.scrollTop = messageList.scrollHeight;
}

/**
 * 获取角色名称
 */
function getRoleName(role) {
  const names = {
    user: '👤 你',
    assistant: '🤖 AI',
    tool: '🛠️ 工具',
    error: '❌ 错误',
  };
  return names[role] || role;
}

/**
 * 格式化内容
 */
function formatContent(content) {
  // 简单的 Markdown 支持
  return content
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// 初始化
init();
