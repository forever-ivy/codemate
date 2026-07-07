#!/bin/bash

echo "🧪 Testing CLI Help Command and Input Clear"
echo "=========================================="
echo ""
echo "Instructions:"
echo "1. The CLI will start"
echo "2. Type '/help' and press Enter"
echo "3. Verify that:"
echo "   - Help command output appears"
echo "   - Input box is cleared after pressing Enter"
echo "4. Try typing '/help clear' for specific command help"
echo "5. Press Ctrl+C to exit"
echo ""
echo "Starting CLI in 3 seconds..."
sleep 3

cd "$(dirname "$0")"
npx tsx src/cli.ts