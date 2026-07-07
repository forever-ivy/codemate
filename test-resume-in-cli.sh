#!/bin/bash

# Resume命令在CLI中的实际测试
# 
# 说明：
# 1. 启动CLI
# 2. 输入 "/" 查看命令列表
# 3. 检查是否显示 /resume 命令

echo "🧪 测试Resume命令在CLI中的显示"
echo ""
echo "📝 请按以下步骤操作："
echo "   1. CLI启动后，输入单个斜杠: /"
echo "   2. 查看命令列表中是否包含 /resume"
echo "   3. 按 Ctrl+C 退出"
echo ""
echo "⏳ 启动CLI..."
echo ""

# 运行CLI
node dist/cli.js
