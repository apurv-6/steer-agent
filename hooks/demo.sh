#!/usr/bin/env bash
# Demo script: 3 prompts showing BLOCKED → NEEDS_INFO → READY
# Run from project root: bash hooks/demo.sh

set -e
HOOK="node hooks/steer-gate-hook.js"

echo "═══════════════════════════════════════════════════"
echo " SteerAgent Hook Demo"
echo "═══════════════════════════════════════════════════"
echo ""

# Test 1: Bad prompt → BLOCKED
echo "━━━ Test 1: Vague prompt ━━━"
echo "Input: \"fix it\""
RESULT=$(echo '{"prompt":"fix it"}' | $HOOK)
echo "Output: $RESULT" | python3 -m json.tool 2>/dev/null || echo "Output: $RESULT"
CONTINUE=$(echo "$RESULT" | python3 -c "import sys,json;print(json.load(sys.stdin)['continue'])" 2>/dev/null)
echo "→ continue: $CONTINUE (expected: False)"
echo ""

# Test 2: Partial prompt → NEEDS_INFO
echo "━━━ Test 2: Partial prompt (has GOAL, missing LIMITS + REVIEW) ━━━"
PROMPT2=$(printf '{"prompt":"## GOAL\\nAdd JWT-based authentication returning access + refresh tokens"}')
echo "Input: $PROMPT2"
RESULT=$(echo "$PROMPT2" | $HOOK)
echo "Output: $RESULT" | python3 -m json.tool 2>/dev/null || echo "Output: $RESULT"
CONTINUE=$(echo "$RESULT" | python3 -c "import sys,json;print(json.load(sys.stdin)['continue'])" 2>/dev/null)
echo "→ continue: $CONTINUE (expected: True)"
echo ""

# Test 3: Good prompt → READY
echo "━━━ Test 3: Well-structured prompt ━━━"
PROMPT3=$(printf '{"prompt":"## GOAL\\nAdd JWT login endpoint returning access + refresh tokens\\n## LIMITS\\nOnly modify src/auth/. No DB schema changes. Max 200 lines.\\n## REVIEW\\nMust pass existing auth tests + new login endpoint test."}')
echo "Input: $PROMPT3"
RESULT=$(echo "$PROMPT3" | $HOOK)
echo "Output: $RESULT" | python3 -m json.tool 2>/dev/null || echo "Output: $RESULT"
CONTINUE=$(echo "$RESULT" | python3 -c "import sys,json;print(json.load(sys.stdin)['continue'])" 2>/dev/null)
echo "→ continue: $CONTINUE (expected: True)"
echo ""

echo "═══════════════════════════════════════════════════"
echo " Demo complete. Gate calls: 3"
echo "═══════════════════════════════════════════════════"
