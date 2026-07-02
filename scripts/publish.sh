#!/bin/bash

# 发布脚本
# 用法: ./scripts/publish.sh

set -e

echo "🚀 开始发布流程..."
echo ""

# 1. 检查是否登录 npm
echo "📝 检查 npm 登录状态..."
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ 未登录 npm，请先运行: npm login"
  exit 1
fi

echo "✅ 已登录为: $(npm whoami)"
echo ""

# 2. 检查工作目录是否干净（如果有 git）
if [ -d .git ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  工作目录有未提交的更改"
    read -p "是否继续发布? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# 3. 运行 CI 检查
echo "🔍 运行 CI 检查..."
pnpm ci:quick
echo ""

# 4. 构建
echo "🔨 构建项目..."
pnpm build
echo ""

# 5. 显示即将发布的版本
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")

echo "📦 即将发布:"
echo "   包名: $PACKAGE_NAME"
echo "   版本: $VERSION"
echo ""

# 6. 确认发布
read -p "确认发布到 npm? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 取消发布"
  exit 1
fi

# 7. 发布
echo ""
echo "📤 发布到 npm..."
pnpm publish --no-git-checks

echo ""
echo "✅ 发布成功!"
echo ""
echo "验证发布:"
echo "  npm view $PACKAGE_NAME"
echo "  npm install -g $PACKAGE_NAME@$VERSION"
echo "  codemate --version"
