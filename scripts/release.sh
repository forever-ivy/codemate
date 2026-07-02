#!/bin/bash

# 发布脚本 - 自动化版本发布流程

set -e

echo "🚀 开始发布流程..."
echo ""

# 1. 检查是否在 main 分支
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "❌ 错误: 必须在 main 分支上发布"
  echo "当前分支: $BRANCH"
  exit 1
fi

# 2. 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ 错误: 有未提交的更改"
  git status --short
  exit 1
fi

# 3. 拉取最新代码
echo "📥 拉取最新代码..."
git pull

# 4. 运行 CI 检查
echo ""
echo "🔍 运行 CI 检查..."
npm run ci

# 5. 构建
echo ""
echo "🔨 构建项目..."
npm run build

# 6. 询问版本类型
echo ""
echo "请选择版本类型:"
echo "  1. patch (bug 修复) - 1.0.0 -> 1.0.1"
echo "  2. minor (新功能) - 1.0.0 -> 1.1.0"
echo "  3. major (破坏性变更) - 1.0.0 -> 2.0.0"
echo ""
read -p "请输入选项 (1/2/3): " VERSION_TYPE

case $VERSION_TYPE in
  1)
    VERSION_ARG="patch"
    ;;
  2)
    VERSION_ARG="minor"
    ;;
  3)
    VERSION_ARG="major"
    ;;
  *)
    echo "❌ 无效的选项"
    exit 1
    ;;
esac

# 7. 更新版本号
echo ""
echo "📝 更新版本号..."
npm version $VERSION_ARG

# 8. 获取新版本号
NEW_VERSION=$(node -p "require('./package.json').version")
echo "✅ 新版本: $NEW_VERSION"

# 9. 推送到 GitHub
echo ""
echo "📤 推送到 GitHub..."
git push && git push --tags

# 10. 提示创建 Release
echo ""
echo "✅ 发布准备完成！"
echo ""
echo "下一步:"
echo "1. 在 GitHub 上创建 Release: https://github.com/your-org/aicli/releases/new"
echo "2. 选择 tag: v$NEW_VERSION"
echo "3. 填写 Release Notes"
echo "4. 发布后 GitHub Actions 会自动发布到 npm"
echo ""
