#!/usr/bin/env python3
"""Manual smoke test for Phase 3: Audio and Desktop Injection.

Usage:
    uv run python scripts/smoke_dictation.py

Prerequisites:
    - Linux with ALSA (arecord)
    - X11 desktop session
    - xclip and xdotool installed
    - Microphone connected and working

This script tests the full pipeline without GUI:
    1. Record audio from microphone
    2. Transcribe via MiMo ASR (requires ASR_LINUX_MIMO_API_KEY)
    3. Polish via MiMo LLM (requires ASR_LINUX_MIMO_API_KEY)
    4. Inject text into focused window
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from backend.audio_recorder import AudioRecorder
from backend.config import Settings
from backend.text_injector import TextInjector


async def test_recorder() -> Path | None:
    """Test audio recording. Returns path to recorded file."""
    print("\n[1/4] Audio Recorder Test")
    print("-" * 40)

    settings = Settings()
    recorder = AudioRecorder(settings)

    print("Press ENTER to start recording (5 seconds max)...")
    input()

    try:
        session_id = await recorder.start()
        print(f"Recording started: {session_id}")

        # Show levels for 5 seconds
        for _i in range(10):
            await asyncio.sleep(0.5)
            level = await recorder.get_level()
            bar = "█" * int(level * 20)
            print(f"  Level: [{bar:<20}] {level:.2f}")

        audio_path = await recorder.stop()
        print(f"Recording saved: {audio_path}")

        if audio_path.exists():
            size = audio_path.stat().st_size
            print(f"File size: {size} bytes")
            if size > 0:
                print("✅ Recorder test PASSED")
                return audio_path

        print("❌ Recorder test FAILED: empty file")
        return None

    except FileNotFoundError:
        print("❌ arecord not found. Install alsa-utils.")
        return None
    except Exception as e:
        print(f"❌ Recorder test FAILED: {e}")
        return None


async def test_injector() -> bool:
    """Test text injection."""
    print("\n[2/4] Text Injector Test")
    print("-" * 40)

    injector = TextInjector()

    print("Focus a text input window (e.g., text editor, browser).")
    print("Press ENTER to inject test text...")
    input()

    result = await injector.inject("Hello from ASR Linux smoke test!")

    print(f"Success: {result.success}")
    print(f"Method: {result.method}")
    print(f"Clipboard saved: {result.clipboard_saved}")
    if result.error:
        print(f"Error: {result.error}")

    if result.success:
        print("✅ Injector test PASSED")
        return True
    elif result.method == "clipboard_fallback":
        print("⚠️  Injector test PARTIAL: text is in clipboard")
        return True
    else:
        print("❌ Injector test FAILED")
        return False


async def test_asr(audio_path: Path) -> str | None:
    """Test ASR transcription. Returns transcribed text."""
    print("\n[3/4] ASR Client Test")
    print("-" * 40)

    api_key = os.environ.get("ASR_LINUX_MIMO_API_KEY")
    if not api_key:
        print("Skip: ASR_LINUX_MIMO_API_KEY not set")
        return None

    from backend.asr_client import ASRClient

    client = ASRClient(api_key=api_key)

    try:
        with open(audio_path, "rb") as f:
            audio_data = f.read()

        text = await client.transcribe(audio_data)
        print(f"Transcribed: {text}")
        print("✅ ASR test PASSED")
        return text
    except Exception as e:
        print(f"❌ ASR test FAILED: {e}")
        return None


async def test_polish(raw_text: str) -> str | None:
    """Test text polishing. Returns polished text."""
    print("\n[4/4] Polish Client Test")
    print("-" * 40)

    api_key = os.environ.get("ASR_LINUX_MIMO_API_KEY")
    if not api_key:
        print("Skip: ASR_LINUX_MIMO_API_KEY not set")
        return None

    from backend.polish_client import PolishClient

    client = PolishClient(api_key=api_key)

    try:
        prompt_template = "Fix grammar and punctuation: {text}"
        polished = await client.polish(raw_text, prompt_template=prompt_template)
        print(f"Polished: {polished}")
        print("✅ Polish test PASSED")
        return polished
    except Exception as e:
        print(f"❌ Polish test FAILED: {e}")
        return None


async def main() -> int:
    """Run smoke tests."""
    print("=" * 50)
    print("ASR Linux Phase 3 Smoke Test")
    print("=" * 50)
    print("\nPrerequisites:")
    print("  - Microphone connected")
    print("  - arecord, xclip, xdotool installed")
    print("  - X11 desktop session")
    print("  - Optional: ASR_LINUX_MIMO_API_KEY for API tests")

    results = []

    # Test 1: Recorder
    audio_path = await test_recorder()
    results.append(audio_path is not None)

    # Test 2: Injector
    injector_ok = await test_injector()
    results.append(injector_ok)

    # Test 3 & 4: ASR and Polish (require API key)
    if audio_path:
        raw_text = await test_asr(audio_path)
        if raw_text:
            polished = await test_polish(raw_text)
            results.append(polished is not None)
        else:
            results.append(False)
    else:
        print("\n[3/4] ASR test SKIPPED (no audio)")
        print("[4/4] Polish test SKIPPED (no audio)")
        results.append(False)
        results.append(False)

    # Summary
    print("\n" + "=" * 50)
    print("Smoke Test Summary")
    print("=" * 50)

    tests = ["Recorder", "Injector", "ASR", "Polish"]
    for name, ok in zip(tests, results, strict=False):
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"  {name}: {status}")

    passed = sum(results)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
