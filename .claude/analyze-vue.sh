#!/bin/bash
# Vue Component Performance Analyzer
# Usage: ./analyze-vue.sh [directory]

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
ANALYSIS_DIR="${1:-client/src}"

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/analyze-vue.js" "$ANALYSIS_DIR"
