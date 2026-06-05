# GSD 人工参与度流程图

## 图例
- 🟢 **全自动** — 无需人工，后台自运行
- 🟡 **人在场** — 需要实时参与决策
- 🔵 **人验收** — 完成后需要人工检查确认
- ⚪ **可选** — 可自动也可人工，取决于配置

---

## 完整流程图（Mermaid）

```mermaid
flowchart TD
    subgraph Init["项目初始化"]
        A1[/gsd-map-codebase/] -->|🟢 全自动| A2[/gsd-new-milestone/]
        A2 -->|🟡 人在场<br/>需求澄清、范围界定| A3[ROADMAP.md]
    end

    subgraph Phase1["Phase 1: Backend Foundation"]
        P1A[/gsd-discuss-phase 1/] -->|🟡 人在场<br/>架构决策、技术选型| P1B[/gsd-plan-phase 1/]
        P1B -->|🟢 全自动<br/>需求清晰时| P1C[PLAN.md]
        P1C -->|🟢 全自动<br/>Wave并行执行| P1D[SUMMARY.md]
        P1D -->|🔵 人验收<br/>健康路由/日志验证| P1E{通过?}
        P1E -->|否| P1F[/gsd-debug/]
        P1F -->|🟡 人在场<br/>复杂问题判断| P1B
        P1E -->|是| P1G[Phase 1 ✅]
    end

    subgraph Phase2["Phase 2: API Clients"]
        P2A[/gsd-discuss-phase 2/] -->|🟡 人在场<br/>API契约、重试策略| P2B[/gsd-plan-phase 2/]
        P2B -->|🟢 全自动| P2C[PLAN.md]
        P2C -->|🟢 全自动<br/>Wave1: ASR+Mock并行| P2D1
        P2D1 -->|🟢 全自动<br/>Wave2: Polish并行| P2D2
        P2D2 -->|🟢 全自动<br/>Wave3: Orchestrator| P2D3
        P2D3 -->|🟢 全自动<br/>Wave4: History并行| P2E[SUMMARY.md]
        P2E -->|🔵 人验收<br/>端到端fixture测试| P2F{通过?}
        P2F -->|否| P2G[/gsd-debug/]
        P2G -->|⚪ 可选<br/>简单问题可自动修复| P2B
        P2F -->|是| P2H[Phase 2 ✅]
    end

    subgraph Phase3["Phase 3: Audio & Injection"]
        P3A[/gsd-discuss-phase 3/] -->|🟡 人在场<br/>音频库选择、注入策略| P3B[/gsd-plan-phase 3/]
        P3B -->|🟢 全自动| P3C[PLAN.md]
        P3C -->|🟢 全自动| P3D[SUMMARY.md]
        P3D -->|🔵 人验收<br/>真实麦克风+桌面注入<br/>smoke test| P3E{通过?}
        P3E -->|否| P3F[/gsd-debug/]
        P3F -->|🟡 人在场<br/>环境问题需人工排查| P3B
        P3E -->|是| P3G[Phase 3 ✅]
    end

    subgraph Phase4["Phase 4: GUI MVP"]
        P4A[/gsd-discuss-phase 4/] -->|🟡 人在场<br/>UX设计、交互细节| P4B[/gsd-plan-phase 4/]
        P4B -->|⚪ 可选<br/>可用/gsd-ui-phase辅助| P4C[PLAN.md]
        P4C -->|🟢 全自动| P4D[SUMMARY.md]
        P4D -->|🔵 人验收<br/>GUI操作流程<br/>热键/覆盖层测试| P4E{通过?}
        P4E -->|否| P4F[/gsd-debug/]
        P4F -->|🟡 人在场<br/>UI问题需目视确认| P4B
        P4E -->|是| P4G[Phase 4 ✅]
    end

    subgraph Phase5["Phase 5: Hardening"]
        P5A[/gsd-plan-phase 5<br/>--skip-discuss/] -->|🟢 全自动<br/>需求明确| P5B[PLAN.md]
        P5B -->|🟢 全自动| P5C[SUMMARY.md]
        P5C -->|🔵 人验收<br/>错误恢复/重试/日志| P5D{通过?}
        P5D -->|否| P5E[/gsd-debug/]
        P5E -->|⚪ 可选| P5B
        P5D -->|是| P5F[Phase 5 ✅]
    end

    subgraph Milestone["里程碑收尾"]
        M1[/gsd-complete-milestone/] -->|🔵 人验收<br/>需求覆盖率检查| M2[归档]
        M2 -->|🟡 人在场<br/>发布决策| M3[v1.0 Tag]
    end

    subgraph Autonomous["全自动模式<br/>（备选）"]
        AUTO[/gsd-autonomous<br/>--from 1 --to 5/] -->|🟢 全自动<br/>只在灰区暂停| AUTO1[Phase 1-5<br/>无人值守]
        AUTO1 -->|🔵 人验收<br/>最终验证| AUTO2{通过?}
    end

    A3 --> P1A
    P1G --> P2A
    P2H --> P3A
    P3G --> P4A
    P4G --> P5A
    P5F --> M1

    %% 并行轨道
    subgraph Parallel["并行轨道（同时运行）"]
        PA1[Wayland Workspace] -->|🟢 全自动<br/>独立worktree| PA2[/gsd-spike/]
        PA2 -->|🟡 人在场<br/>结果评估| PA3{可行?}
        PA3 -->|是| PA4[种子记录]
        PA3 -->|否| PA5[归档]

        PB1[Test Workstream] -->|🟢 全自动| PB2[并行写测试]
    end

    P1G -.->|并行启动| PA1
    P2H -.->|并行启动| PB1
```

---

## 简化版：人工参与度速查表

| 阶段 | 命令 | 参与度 | 说明 |
|------|------|--------|------|
| **代码地图** | `/gsd-map-codebase` | 🟢 全自动 | 分析代码库，无需在场 |
| **里程碑启动** | `/gsd-new-milestone` | 🟡 人在场 | 需求澄清、范围界定 |
| **Phase 讨论** | `/gsd-discuss-phase` | 🟡 人在场 | 架构/UX决策、灰区确认 |
| **Phase 规划** | `/gsd-plan-phase` | 🟢/⚪ 自动/可选 | 需求清晰时全自动 |
| **Phase 执行** | `/gsd-execute-phase` | 🟢 全自动 | Wave内任务并行自运行 |
| **代码审查** | `/gsd-code-review` | ⚪ 可选 | 可自动跑，但建议人工看 |
| **Phase 验收** | `/gsd-verify-work` | 🔵 人验收 | 必须人工确认功能正确 |
| **Debug** | `/gsd-debug` | 🟡/⚪ 视复杂度 | 简单问题可自动，复杂需人 |
| **里程碑完成** | `/gsd-complete-milestone` | 🔵 人验收 | 需求覆盖率最终确认 |
| **全自动流水线** | `/gsd-autonomous` | 🟢+🟡 混合 | 自动运行，灰区时暂停等人 |

---

## 推荐的"人在场"节奏

```
Day 1  上午: /gsd-new-milestone          ← 人在场（2小时）
Day 1  下午: /gsd-autonomous --only 1     ← 离开，全自动

Day 2  上午: /gsd-verify-work 1           ← 人在场验收（30分钟）
Day 2  上午: /gsd-discuss-phase 2         ← 人在场决策（1小时）
Day 2  下午: /gsd-manager                  ← 人在场调度
            ├─ 前台: Phase 3 discuss
            └─ 后台: Phase 2 execute

Day 3-5:    全自动执行 Phase 2-3          ← 离开

Day 6:      /gsd-verify-work 2-3          ← 人在场验收
            /gsd-discuss-phase 4          ← 人在场 UX 设计

Day 7-10:   全自动 Phase 4-5              ← 离开

Day 11:     /gsd-verify-work 4-5          ← 人在场验收
            /gsd-complete-milestone       ← 人在场发布决策
```

**实际人在场时间**：约 8-10 小时（分布在 11 天中）
**全自动运行时间**：约 70-80% 的项目周期
