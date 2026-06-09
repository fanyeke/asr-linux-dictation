"""Detect languages in transcribed text for dynamic prompt selection.

Provides functions to analyze transcribed text and determine the
primary language(s) used, enabling language-aware prompt selection
in the dictation pipeline.
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Character ranges
# ---------------------------------------------------------------------------

# CJK Unified Ideographs + Extension A
_CJK_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
# Basic Latin + Latin-1 Supplement (English/European)
_LATIN_RE = re.compile(r"[a-zA-Z\u00c0-\u024f]")
# Hiragana + Katakana (Japanese)
_JP_RE = re.compile(r"[\u3040-\u309f\u30a0-\u30ff]")
# Korean Hangul
_KO_RE = re.compile(r"[\uac00-\ud7af]")


def detect_language(text: str) -> str:
    """Detect the primary language of the transcribed text.

    Analyzes character composition to determine the dominant language.
    Returns one of: ``"zh"`` (Chinese), ``"en"`` (English),
    ``"jp"`` (Japanese), ``"ko"`` (Korean), ``"mixed"`` (CJK + Latin mix),
    or ``"unknown"`` (no identifiable script).

    Args:
        text: The transcribed text to analyze.

    Returns:
        A language code string.
    """
    if not text or not text.strip():
        return "unknown"

    cjk = len(_CJK_RE.findall(text))
    latin = len(_LATIN_RE.findall(text))
    jp = len(_JP_RE.findall(text))
    ko = len(_KO_RE.findall(text))

    total_identified = cjk + latin + jp + ko
    if total_identified == 0:
        return "unknown"

    # Ratios
    cjk_ratio = cjk / total_identified
    latin_ratio = latin / total_identified

    # Mixed detection: both CJK and Latin present in meaningful amounts
    if cjk > 0 and latin > 0:
        return "mixed"

    # Pure/single language detection
    if latin_ratio > 0.85:
        return "en"
    if cjk_ratio > 0.85 and jp == 0 and ko == 0:
        return "zh"
    if jp > total_identified * 0.7:
        return "jp"
    if ko > total_identified * 0.7:
        return "ko"

    # Default: whichever script is dominant
    if cjk >= latin and cjk >= jp and cjk >= ko:
        return "zh"
    if latin >= cjk and latin >= jp and latin >= ko:
        return "en"

    return "mixed"


def detect_language_for_prompt(text: str) -> str:
    """Get the prompt category suitable for the detected language.

    Maps detected languages to prompt categories understood by
    the prompt manager. Returns ``"zh"``, ``"en"``, or ``"mixed"``.

    Args:
        text: The transcribed text to analyze.

    Returns:
        A prompt category string.
    """
    lang = detect_language(text)
    if lang == "zh":
        return "zh"
    elif lang in ("en",):
        return "en"
    else:
        return "mixed"


def get_language_breakdown(text: str) -> dict:
    """Get a detailed breakdown of languages in the text.

    Returns counts of each script type found.

    Args:
        text: The transcribed text to analyze.

    Returns:
        A dict with ``cjk``, ``latin``, ``jp``, ``ko``, ``other`` counts
        and the ``primary`` language code.
    """
    total = len(text.strip()) if text.strip() else 1
    cjk = len(_CJK_RE.findall(text))
    latin = len(_LATIN_RE.findall(text))
    jp = len(_JP_RE.findall(text))
    ko = len(_KO_RE.findall(text))
    other = max(0, total - (cjk + latin + jp + ko))

    return {
        "cjk": cjk,
        "latin": latin,
        "japanese": jp,
        "korean": ko,
        "other": other,
        "primary": detect_language(text),
    }
