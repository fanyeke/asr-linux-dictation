# Phase 9: Scene Profiles — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

## Phase Boundary

5 preset scene system with CRUD, pipeline integration, and quick-switch.

## Presets

| 场景 | Prompt 风格 | ASR 语言 |
|------|------------|----------|
| 通用 | 加标点、去填充词 | auto |
| 编程 | 保留驼峰/蛇形、代码关键词(TODO/FIXME)、不补括号 | auto |
| 写作 | 书面语、长句断句、自动分段 | auto |
| 会议记录 | 精简输出、去口语化、保留关键信息 | auto |
| 聊天 | 保留语气词、口语化 | auto |

## Pipeline Integration

When dictation runs:
1. Load active profile from `profiles` table
2. Use profile's `prompt_template` instead of the prompt manager's active prompt
3. Filter dictionary entries to those listed in profile's `dictionary_ids`
4. Use profile's `asr_language`

## Design Decisions

- `profiles.builtin` flag prevents deletion of presets
- `profiles.is_active` singleton flag (only one profile active at a time)
- Users can duplicate a preset and customize
- Tray submenu for quick-switch (similar to ASR language)
- DictionaryAssociation: `dictionary_ids` comma-separated string

---

*Phase: 09-scene-profiles*
*Context gathered: 2026-06-06*
