#!/bin/bash
set -euo pipefail

echo "🔍 Checking for secrets in .env.example..."

# Ensure .env.example exists
if [ ! -f ".env.example" ]; then
    echo "⚠️  Warning: .env.example not found"
    exit 0
fi

# Check for real API keys
if grep -E "GEMINI_API_KEY=(AIza[a-zA-Z0-9_-]{35}|AI[a-zA-Z0-9_-]{30,})" .env.example; then
    echo "❌ Error: .env.example contains what looks like a real API key!"
    echo ""
    echo "   Current value matches a real Gemini API key pattern."
    echo "   Please use the placeholder: YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY"
    echo ""
    exit 1
fi

# Check that .env is not being committed
# The '|| true' is to handle cases where there are no staged changes or other git errors gracefully,
# though strictly we care about the output of grep.
# If grep finds .env, it returns 0 (true), entering the if block.
if git diff --cached --name-only | grep -q "^\.env$" 2>/dev/null; then
    echo "❌ Error: Attempting to commit .env file!"
    echo "   The .env file contains secrets and should never be committed."
    exit 1
fi

echo "✅ Secret check passed."
