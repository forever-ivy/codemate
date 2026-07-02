#!/bin/bash

# 本地测试脚本 - 模拟真实安装和使用

set -e

echo "🧪 开始本地测试..."
echo ""

# 1. 构建项目
echo "🔨 构建项目..."
npm run build

# 2. 打包
echo ""
echo "📦 打包..."
TARBALL=$(npm pack)
echo "生成: $TARBALL"

# 3. 创建临时测试目录
TEST_DIR="/tmp/aicli-test-$(date +%s)"
mkdir -p "$TEST_DIR"
echo ""
echo "📁 测试目录: $TEST_DIR"

# 4. 移动 tarball 到测试目录
mv "$TARBALL" "$TEST_DIR/"
cd "$TEST_DIR"

# 5. 全局安装
echo ""
echo "📥 全局安装..."
npm install -g "$TARBALL"

# 6. 测试命令
echo ""
echo "✅ 测试 CLI 命令..."
echo ""

echo "1. 测试 --version:"
aicli --version

echo ""
echo "2. 测试 --help:"
aicli --help

# 7. 清理
echo ""
echo "🧹 清理..."
npm uninstall -g @your-org/aicli
cd -
rm -rf "$TEST_DIR"

echo ""
echo "✅ 本地测试完成！"
echo ""
echo "如果所有测试都通过，可以运行 ./scripts/release.sh 发布"
echo ""
