#!/bin/bash

# 测试本地安装脚本
# 用于在发布前验证包是否可以正常安装和运行

set -e

echo "🔨 Building package..."
npm run build

echo ""
echo "📦 Creating tarball..."
npm pack

# 获取当前版本号
VERSION=$(node -p "require('./package.json').version")
TARBALL="laf-fe-codemate-cli-${VERSION}.tgz"

echo ""
echo "🧹 Cleaning old installation..."
npm uninstall -g @laf-fe/codemate-cli 2>/dev/null || true

echo ""
echo "🧪 Installing package globally from ${TARBALL}..."
npm install -g ./${TARBALL}

echo ""
echo "✅ Testing installation..."
echo "Version:"
codemate --version

echo ""
echo "Help:"
codemate --help

echo ""
echo "🎉 Installation test successful!"
echo ""
echo "You can now test the CLI with:"
echo "  codemate"
echo ""
echo "To uninstall:"
echo "  npm uninstall -g @laf-fe/codemate-cli"
