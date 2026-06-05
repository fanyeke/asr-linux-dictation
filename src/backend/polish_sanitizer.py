"""Sanitizer for LLM polish output.

Provides ``sanitize_polish_output()`` to strip common LLM artifacts
such as greeting prefixes, markdown code fences, and trailing
explanations from generated polish text.
"""

from __future__ import annotations

import re

# Greeting / prefix patterns — matched at the start of text (case-insensitive
# for English phrases).
_GREETING_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^你好\s*"),
    re.compile(r"^您好\s*"),
    re.compile(r"^Sure,\s*", re.IGNORECASE),
    re.compile(r"^Here\s+is\s+", re.IGNORECASE),
    re.compile(r"^Of\s+course\s+", re.IGNORECASE),
]

# Markdown code-fence pattern: triple backticks with optional language
# identifier (must be followed by newline when present), then content,
# then closing triple backticks.
# The language part (\w+\n) only matches when there IS a newline after
# it, which prevents it from consuming inline content like ``inline``.
_FENCE_PATTERN = re.compile(r"```(?:\w+\n)?(.*?)```", re.DOTALL)

# Trailing explanation markers.
_EXPLANATION_MARKERS = [
    "Explanation:",
    "解释：",
]


def sanitize_polish_output(text: str) -> str:
    """Clean up LLM polish output.

    Removes (in order):
    1. Common greeting prefixes (你好, 您好, Sure,, Here is, Of course).
    2. Markdown code fences (triple backticks).
    3. Trailing explanations (text after ``Explanation:`` or ``解释：``).
    4. Leading / trailing whitespace.

    If no sanitization is needed the original string object is returned
    unchanged.

    Args:
        text: Raw output from an LLM polish call.

    Returns:
        Cleaned-up text.
    """
    original = text
    result = text

    # 1. Remove greeting prefixes — only the first matching one
    for pattern in _GREETING_PATTERNS:
        if pattern.match(result):
            result = pattern.sub("", result, count=1)
            break

    # 2. Remove markdown code fences
    result = _FENCE_PATTERN.sub(r"\1", result)

    # 3. Remove trailing explanations
    for marker in _EXPLANATION_MARKERS:
        idx = result.find(marker)
        if idx != -1:
            result = result[:idx]

    # 4. Strip whitespace
    result = result.strip()

    # Return original if nothing changed
    return result if result != original else original
