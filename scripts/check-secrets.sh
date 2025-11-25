#!/bin/bash
set -euo pipefail

# Determine the repository root to ensure the script runs correctly from any directory
GIT_ROOT=$(git rev-parse --show-toplevel)

# Allow overriding the target file via the first argument
# Defaults to .env.example in the git root
TARGET_FILE="${1:-$GIT_ROOT/.env.example}"

echo "🔍 Checking for secrets in $TARGET_FILE..."

# Ensure target file exists
if [ ! -f "$TARGET_FILE" ]; then
    echo "⚠️  Warning: Target file not found at $TARGET_FILE"
    exit 0
fi

# Check for real API keys
# Matches Gemini API keys which typically start with 'AIza' and are approx 39 chars long.
if grep -E "GEMINI_API_KEY=AIza[a-zA-Z0-9_-]{35}" "$TARGET_FILE"; then
    echo "❌ Error: $TARGET_FILE contains what looks like a real API key!"
    echo ""
    echo "   Current value matches a real Gemini API key pattern."
    echo "   Please use the placeholder: YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY"
    echo ""
    exit 1
fi

# Check that .env is not being committed
# This check only applies when running as a pre-commit hook (no argument provided implies default behavior)
# or can be skipped during testing if needed. For now, we keep it but it checks staged files.
if git diff --cached --name-only | grep -q "^\.env$" 2>/dev/null; then
    echo "❌ Error: Attempting to commit .env file!"
    echo "   The .env file contains secrets and should never be committed."
    exit 1
fi

echo "✅ Secret check passed."
