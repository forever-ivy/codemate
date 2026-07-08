#!/bin/bash

# 测试首次运行配置向导
# 模拟用户输入：选择 DeepSeek (选项3)，输入测试 API Key

echo "=== 测试 CodeMate AI 首次运行配置 ==="
echo ""

# 检查配置文件是否存在
if [ -f ~/.aiclirc.json ]; then
  echo "⚠️  配置文件已存在，备份并删除..."
  cp ~/.aiclirc.json ~/.aiclirc.json.backup
  rm ~/.aiclirc.json
fi

echo "✅ 准备测试首次运行"
echo ""

# 模拟用户输入：
# 3 - 选择 DeepSeek
# test-api-key-12345 - 输入测试 API Key
# (空) - 使用默认模型
echo "模拟输入："
echo "  1. 选择提供商: 3 (DeepSeek)"
echo "  2. API Key: test-api-key-12345"
echo "  3. 模型: (使用默认 deepseek-chat)"
echo ""

# 使用 echo 管道输入
echo -e "3\ntest-api-key-12345\n" | codemate config

echo ""
echo "=== 检查生成的配置文件 ==="
echo ""

if [ -f ~/.aiclirc.json ]; then
  echo "✅ 配置文件已创建: ~/.aiclirc.json"
  echo ""
  echo "配置内容："
  cat ~/.aiclirc.json | jq '.' 2>/dev/null || cat ~/.aiclirc.json
  echo ""
  
  # 验证配置结构
  echo "=== 验证配置结构 ==="
  
  # 检查必需字段
  if cat ~/.aiclirc.json | jq -e '.app' > /dev/null 2>&1; then
    echo "✅ app 配置存在"
  else
    echo "❌ app 配置缺失"
  fi
  
  if cat ~/.aiclirc.json | jq -e '.model' > /dev/null 2>&1; then
    echo "✅ model 配置存在"
  else
    echo "❌ model 配置缺失"
  fi
  
  if cat ~/.aiclirc.json | jq -e '.model.apiKey' > /dev/null 2>&1; then
    echo "✅ API Key 已设置"
  else
    echo "❌ API Key 缺失"
  fi
  
  if cat ~/.aiclirc.json | jq -e '.model.baseURL' > /dev/null 2>&1; then
    echo "✅ Base URL 已设置"
  else
    echo "❌ Base URL 缺失"
  fi
  
  if cat ~/.aiclirc.json | jq -e '.tools' > /dev/null 2>&1; then
    echo "✅ tools 配置存在"
  else
    echo "❌ tools 配置缺失"
  fi
  
  if cat ~/.aiclirc.json | jq -e '.ui' > /dev/null 2>&1; then
    echo "✅ ui 配置存在"
  else
    echo "❌ ui 配置缺失"
  fi
  
  echo ""
  echo "✅ 首次运行配置测试完成！"
else
  echo "❌ 配置文件未创建"
  exit 1
fi
