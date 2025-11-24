#!/bin/bash

# .env.exampleファイルに本物のキーっぽい文字列がないかチェック
if grep -E "GEMINI_API_KEY=AI[a-zA-Z0-9]{30,}" .env.example; then
    echo "Error: .env.example contains what looks like a real API key!"
    exit 1
fi

echo "Secret check passed."
