#!/bin/bash
set -euo pipefail

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: git command not found"
    exit 1
fi

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
# Matches Gemini API keys which typically start with 'AIza' and are exactly 39 chars long.
# Regex explanation:
# GEMINI_API_KEY  : Match literal key name
# [[:space:]]*=[[:space:]]* : Match equals sign with optional surrounding whitespace (POSIX compliant)
# ["']?           : Match optional opening quote (double or single)
# AIza            : Match Gemini key prefix
# [a-zA-Z0-9_-]{35}: Match remaining 35 characters (total 39)
# \b              : Ensure word boundary (prevent matching if part of a longer string, though specific to some grep versions)
# Instead of \b which is not POSIX, we can use exact matching logic or rely on the [^a-zA-Z0-9_-] check if needed.
# For simplicity and robustness with basic grep -E:
# We match the specific pattern. To ensure it's not a prefix of a longer string, we can look for end of line or non-word char.
# However, standard API keys usually are standalone. Let's use the strict count {35}.
# To avoid matching a 40 char string, we can ensure the character after is not a valid key char or end of line.
# grep -E doesn't strictly support lookahead.
# We will check if we find a match that is EXACTLY the key format.
# If we simply use {35}, it matches the first 35 of a 40 char string.
# To properly validate "exact length", we can use `grep -E ...` and then inspect.
# Or better: `grep -E ...[^a-zA-Z0-9_-]`?
# Let's stick to the reviewer's suggestion: `AIza[a-zA-Z0-9_-]{35}`.
# Note: strict length check with simple grep is tricky without boundaries.
# We will use `\b` if available or `(^|[^a-zA-Z0-9_-])` logic?
# Let's try to match the line end or non-word char.
# Regex: ...AIza[a-zA-Z0-9_-]{35}([^a-zA-Z0-9_-]|$)
if grep -Eq "GEMINI_API_KEY[[:space:]]*=[[:space:]]*[\"']?AIza[a-zA-Z0-9_-]{35}([\"']?|$|[^a-zA-Z0-9_-])" "$TARGET_FILE"; then
    echo "❌ Error: $TARGET_FILE contains what looks like a real API key!"
    echo ""
    echo "   Current value matches a real Gemini API key pattern (39 characters)."
    echo "   Please use the placeholder: YOUR_GEMINI_API_KEY_HERE_DO_NOT_COMMIT_REAL_KEY"
    echo ""
    exit 1
fi

# Check that .env is not being committed
# This check only applies when running as a pre-commit hook (no argument provided implies default behavior)
# or can be skipped during testing if needed. For now, we keep it but it checks staged files.
if git diff --cached --name-only | grep -q "^\.env$"; then
    echo "❌ Error: Attempting to commit .env file!"
    echo "   The .env file contains secrets and should never be committed."
    exit 1
fi

echo "✅ Secret check passed."
