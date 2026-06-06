# Phase 11: Dashboard + Stats — PLAN.md

## Goal

Transform static dashboard into data-driven insights hub with usage trends, time heatmap, and latency analysis.

## Wave Breakdown

### Wave 1: Backend — Timing breakdown + Stats API

| # | Task | TDD | Files |
|---|------|-----|-------|
| 1.1 | DB migration: add `asr_ms` and `polish_ms` to history table | ✅ | `src/backend/database.py` |
| 1.2 | Orchestrator: save asr_ms and polish_ms separately | ✅ | `src/backend/dictation_orchestrator.py` |
| 1.3 | `GET /dashboard/stats` — daily usage, hourly dist, latency | ✅ | `src/backend/main.py` (new) |
| 1.4 | Tests: timing fields saved + stats endpoint | ✅ | `tests/backend/test_dashboard.py` |

### Wave 2: Frontend — SVG chart components

| # | Task | TDD | Files |
|---|------|-----|-------|
| 2.1 | `<BarChart>` — SVG-based, Framer Motion animated | ✅ | `src/electron/renderer/components/ui/BarChart.tsx` (new) |
| 2.2 | `<LineChart>` — SVG polyline, animated | ✅ | `src/electron/renderer/components/ui/LineChart.tsx` (new) |
| 2.3 | `<Heatmap>` — day×hour grid, color density | ✅ | `src/electron/renderer/components/ui/Heatmap.tsx` (new) |

### Wave 3: Frontend — Dashboard page redesign

| # | Task | TDD | Files |
|---|------|-----|-------|
| 3.1 | DashboardPage: 3-row layout (stats cards + trend + analysis) | ✅ | `src/electron/renderer/components/DashboardPage.tsx` |
| 3.2 | Trend row: 7-day usage bar chart + success rate overlay | ✅ | `src/electron/renderer/components/DashboardPage.tsx` |
| 3.3 | Analysis row: time heatmap + ASR/LLM latency line chart | ✅ | `src/electron/renderer/components/DashboardPage.tsx` |
| 3.4 | Frontend tests: dashboard renders charts | ✅ | tests |
